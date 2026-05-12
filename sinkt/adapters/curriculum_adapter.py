"""
SINKT — Curriculum Adapter
Bridges the extracted curriculum structure (from PDF) to SINKT's training format.
Converts APEX Curriculum JSON → SINKT-compatible training data.

This adapter enables Fine-Tuning SINKT on your specific curriculum content,
creating a custom Knowledge Tracing model that understands YOUR textbook.
"""

import json
import os
import pickle
import numpy as np
from scipy import sparse
from rich.console import Console

console = Console(force_terminal=True)


class CurriculumToSINKT:
    """
    Converts extracted curriculum structure into SINKT-compatible training data.

    SINKT expects:
    1. problem_skill_maxSkillOfProblem_number.pkl  — metadata counts
    2. adj_matrix.npz                              — concept-question adjacency
    3. skillname_id_dict_{model}.npy               — concept embeddings
    4. history_{split}.pkl                          — student interaction histories
    5. id_skill_desc_dict.json                      — concept descriptions
    6. id_skillname_dict.json                       — concept names
    """

    def __init__(self, curriculum_json_path: str, output_dir: str = "data/sinkt_data"):
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)

        with open(curriculum_json_path, "r", encoding="utf-8") as f:
            self.curriculum = json.load(f)

        # Extract flat lists
        self.concepts = []
        self.questions = []
        self.concept_to_questions = {}  # concept_idx -> [question_indices]
        self._flatten_curriculum()

        console.print(f"[green]✅ Loaded curriculum: {len(self.concepts)} concepts, {len(self.questions)} questions[/]")

    def _flatten_curriculum(self):
        """Extract flat concept/question lists from hierarchical curriculum."""
        concept_idx = 0
        question_idx = 0

        for chapter in self.curriculum.get("chapters", []):
            for section in chapter.get("sections", []):
                for concept in section.get("concepts", []):
                    self.concepts.append({
                        "idx": concept_idx,
                        "id": concept.get("id", f"con_{concept_idx}"),
                        "name": concept.get("name", "Unknown"),
                        "description": concept.get("description", ""),
                        "chapter": chapter.get("title", ""),
                        "section": section.get("title", ""),
                        "prerequisites": concept.get("prerequisites", []),
                    })

                    q_indices = []
                    for question in concept.get("questions", []):
                        self.questions.append({
                            "idx": question_idx,
                            "id": question.get("id", f"q_{question_idx}"),
                            "text": question.get("text", ""),
                            "difficulty": question.get("difficulty", "medium"),
                            "concept_idx": concept_idx,
                        })
                        q_indices.append(question_idx)
                        question_idx += 1

                    self.concept_to_questions[concept_idx] = q_indices
                    concept_idx += 1

    def generate_metadata(self):
        """Generate problem_skill_maxSkillOfProblem_number.pkl"""
        problem_number = len(self.questions)
        lesson_number = len(self.concepts)
        concept_number = len(self.concepts)

        # Max concepts per question (usually 1 in curriculum parsing)
        max_concept_of_problem = max(
            1,
            max((1 for _ in self.questions), default=1)
        )

        metadata = (problem_number, lesson_number, concept_number, max_concept_of_problem)

        path = os.path.join(self.output_dir, "problem_skill_maxSkillOfProblem_number.pkl")
        with open(path, "wb") as f:
            pickle.dump(metadata, f)

        console.print(f"[green]  📊 Metadata: {problem_number} questions, {concept_number} concepts[/]")
        return metadata

    def generate_adjacency_matrix(self):
        """
        Generate adj_matrix.npz — the concept-question relationship matrix.

        Matrix structure (from SINKT source code):
        - Size: (concept_num + problem_num) x (concept_num + problem_num)
        - concept-concept edges (prerequisites): value = 1
        - question-concept edges: value = 2
        - concept-question edges: value = 2
        """
        n_concepts = len(self.concepts)
        n_questions = len(self.questions)
        total = n_concepts + n_questions

        adj = np.zeros((total, total), dtype=np.float32)

        # Concept-concept prerequisite edges (value = 1)
        concept_id_to_idx = {c["id"]: c["idx"] for c in self.concepts}
        for concept in self.concepts:
            for prereq_id in concept["prerequisites"]:
                if prereq_id in concept_id_to_idx:
                    prereq_idx = concept_id_to_idx[prereq_id]
                    adj[concept["idx"], prereq_idx] = 1
                    adj[prereq_idx, concept["idx"]] = 1

        # Question-concept edges (value = 2)
        for question in self.questions:
            q_global = n_concepts + question["idx"]
            c_idx = question["concept_idx"]
            adj[q_global, c_idx] = 2  # question -> concept
            adj[c_idx, q_global] = 2  # concept -> question

        sparse_adj = sparse.csr_matrix(adj)
        path = os.path.join(self.output_dir, "adj_matrix.npz")
        sparse.save_npz(path, sparse_adj)

        console.print(f"[green]  🔗 Adjacency matrix: {total}x{total}[/]")
        return adj

    def generate_concept_descriptions(self):
        """Generate id_skill_desc_dict.json and id_skillname_dict.json"""
        desc_dict = {}
        name_dict = {}

        for concept in self.concepts:
            # SINKT uses 1-indexed concept IDs
            key = str(concept["idx"] + 1)
            desc_dict[key] = concept["description"]
            name_dict[key] = concept["name"] + "."

        desc_path = os.path.join(self.output_dir, "id_skill_desc_dict.json")
        name_path = os.path.join(self.output_dir, "id_skillname_dict.json")

        with open(desc_path, "w", encoding="utf-8") as f:
            json.dump(desc_dict, f, ensure_ascii=False, indent=2)

        with open(name_path, "w", encoding="utf-8") as f:
            json.dump(name_dict, f, ensure_ascii=False, indent=2)

        console.print(f"[green]  📝 Concept descriptions: {len(desc_dict)} entries[/]")

    def generate_synthetic_histories(self, n_students: int = 500, seq_len: int = 50):
        """
        Generate synthetic student interaction histories for initial training.

        In production, replace with real APEX Diagnostic session data.

        Each history: list of (question_id, [concept_ids], response, concept_text)
        """
        import random

        for split in ["train", "valid", "test"]:
            n = n_students if split == "train" else n_students // 5
            histories = []

            for _ in range(n):
                student_seq_len = random.randint(10, seq_len)
                records = []

                # Simulate student mastery that improves over time
                mastery = {c["idx"]: random.uniform(0.2, 0.5) for c in self.concepts}

                for step in range(student_seq_len):
                    q = random.choice(self.questions)
                    c_idx = q["concept_idx"]
                    concept = self.concepts[c_idx]

                    # Response probability based on mastery + difficulty
                    diff_modifier = {"easy": 0.2, "medium": 0, "hard": -0.2}.get(q["difficulty"], 0)
                    prob_correct = min(0.95, max(0.05, mastery[c_idx] + diff_modifier))
                    response = 1 if random.random() < prob_correct else 0

                    # Update mastery (learning effect)
                    if response == 1:
                        mastery[c_idx] = min(1.0, mastery[c_idx] + 0.05)
                    else:
                        mastery[c_idx] = min(1.0, mastery[c_idx] + 0.02)

                    records.append((
                        q["idx"] + 1,         # 1-indexed question ID
                        [c_idx + 1],           # 1-indexed concept IDs
                        response,              # 0 or 1
                        concept["name"]        # concept text
                    ))

                histories.append((student_seq_len, records))

            path = os.path.join(self.output_dir, f"history_{split}.pkl")
            with open(path, "wb") as f:
                pickle.dump(histories, f)

            console.print(f"[green]  👥 {split}: {n} synthetic students[/]")

    def generate_all(self, n_students: int = 500):
        """Run the complete data generation pipeline."""
        console.print("[bold cyan]🔄 Generating SINKT training data from curriculum...[/]")
        self.generate_metadata()
        self.generate_adjacency_matrix()
        self.generate_concept_descriptions()
        self.generate_synthetic_histories(n_students)
        console.print(f"[bold green]✅ SINKT data ready at: {self.output_dir}/[/]")


if __name__ == "__main__":
    adapter = CurriculumToSINKT("data/curriculum.json")
    adapter.generate_all()
