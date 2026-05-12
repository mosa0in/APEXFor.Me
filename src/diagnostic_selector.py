"""
APEX Layer 01 — Diagnostic Selector
Diagnostic Test — Initial Knowledge Extraction (15 min)

After building the Knowledge Graph, the student takes a quick diagnostic test
(1-2 questions per core concept). Results create initial mastery_snapshots
for each concept and determine the starting point in the Graph.

WITHOUT THIS STEP, THE SYSTEM IS BLIND.

Components:
- Graph traversal to select representative questions
- BKT initialization from diagnostic responses
- StudentState creation with mastery_snapshots
- Starting point determination in Knowledge Graph
"""

import json
import os
import random
from datetime import datetime
from typing import Literal

from rich.console import Console
from rich.table import Table

from src.config import settings
from src.models import (
    Curriculum,
    Concept,
    Question,
    StudentState,
    MasterySnapshot,
    BKTParams,
    DiagnosticResponse,
    MasteryLevel,
)

console = Console(force_terminal=True)


# ═══════════════════════════════════════════════════════════════════════════════
# Diagnostic Question Selection (Graph Traversal)
# ═══════════════════════════════════════════════════════════════════════════════

class DiagnosticSelector:
    """
    Selects diagnostic questions by traversing the Knowledge Graph.

    Strategy:
    1. Identify CORE concepts (nodes with high connectivity)
    2. For each core concept, pick 1-2 representative questions
    3. Order questions by prerequisite chain (bottom-up)
    4. Total target: ~15 minutes (assumes 1-2 min per question)

    This is NOT random sampling — it's GRAPH-AWARE selection.
    """

    def __init__(self, curriculum: Curriculum):
        self.curriculum = curriculum
        self.all_concepts = curriculum.get_all_concepts()
        self.concept_map = {c.id: c for c in self.all_concepts}

        # Build prerequisite graph for traversal
        self._build_prereq_graph()

    def _build_prereq_graph(self):
        """Build adjacency lists for the prerequisite graph."""
        self.prereq_of: dict[str, list[str]] = {}      # concept -> its prerequisites
        self.depends_on_me: dict[str, list[str]] = {}   # concept -> what depends on it

        for concept in self.all_concepts:
            self.prereq_of[concept.id] = concept.prerequisites
            for prereq_id in concept.prerequisites:
                if prereq_id not in self.depends_on_me:
                    self.depends_on_me[prereq_id] = []
                self.depends_on_me[prereq_id].append(concept.id)

    def _get_concept_importance(self, concept: Concept) -> float:
        """
        Score concept importance for diagnostic selection.

        Factors:
        - How many concepts depend on it (high = more important)
        - Number of questions available
        - Whether it's marked as core
        - Position in prerequisite chain (foundations first)
        """
        dependents = len(self.depends_on_me.get(concept.id, []))
        n_questions = len(concept.questions)
        is_core = 2.0 if concept.is_core else 0.5
        has_prereqs = 0.5 if concept.prerequisites else 1.5  # foundations get bonus

        return (dependents * 3.0 + n_questions * 1.0) * is_core * has_prereqs

    def _topological_sort(self, concept_ids: list[str]) -> list[str]:
        """
        Sort concepts by prerequisite order (foundations first).
        Students should be tested on prerequisites before dependent concepts.
        """
        visited = set()
        order = []

        def dfs(cid: str):
            if cid in visited or cid not in self.concept_map:
                return
            visited.add(cid)
            for prereq_id in self.prereq_of.get(cid, []):
                if prereq_id in set(concept_ids):
                    dfs(prereq_id)
            order.append(cid)

        for cid in concept_ids:
            dfs(cid)

        return order

    def _select_question_for_concept(self, concept: Concept) -> Question | None:
        """
        Pick the best diagnostic question for a concept.

        Priority:
        1. Questions marked as is_diagnostic
        2. Medium difficulty (not too easy, not too hard)
        3. MCQ type (faster to answer)
        4. Lower Bloom's level (tests basic understanding first)
        """
        if not concept.questions:
            return None

        candidates = list(concept.questions)

        # Sort by diagnostic suitability
        def score(q: Question) -> float:
            s = 0.0
            if q.is_diagnostic:
                s += 10.0
            if q.difficulty == "medium":
                s += 3.0
            elif q.difficulty == "easy":
                s += 2.0
            if q.question_type == "mcq":
                s += 2.0
            elif q.question_type == "conceptual":
                s += 1.5
            s += (7 - q.bloom_level)  # Lower Bloom's = higher priority
            return s

        candidates.sort(key=score, reverse=True)
        return candidates[0]

    def select_diagnostic_questions(
        self,
        max_questions: int = 15,
        questions_per_concept: int = 1,
        time_limit_minutes: int = 15,
    ) -> list[dict]:
        """
        Select diagnostic questions by traversing the Knowledge Graph.

        Returns a list of question dicts ordered by prerequisite chain:
        [
            {
                "question": Question,
                "concept": Concept,
                "chapter_title": str,
                "section_title": str,
                "order": int,
                "is_prerequisite": bool,
            }
        ]

        Args:
            max_questions: Maximum number of questions.
            questions_per_concept: How many questions per concept (1-2).
            time_limit_minutes: Target time limit.
        """
        console.print("[bold cyan]Selecting diagnostic questions from Knowledge Graph...[/]")

        # Step 1: Score all concepts by importance
        scored_concepts = [
            (self._get_concept_importance(c), c)
            for c in self.all_concepts
            if c.questions  # Only concepts with questions
        ]
        scored_concepts.sort(key=lambda x: x[0], reverse=True)

        # Step 2: Select top concepts (respecting max questions)
        max_concepts = max_questions // questions_per_concept
        selected_concepts = [c for _, c in scored_concepts[:max_concepts]]
        selected_ids = [c.id for c in selected_concepts]

        # Step 3: Topological sort (prerequisites first)
        ordered_ids = self._topological_sort(selected_ids)

        # Step 4: Pick questions for each concept
        diagnostic_items = []
        for i, cid in enumerate(ordered_ids):
            concept = self.concept_map[cid]
            question = self._select_question_for_concept(concept)
            if not question:
                continue

            # Find chapter/section context
            chapter_title, section_title = self._find_concept_location(cid)

            diagnostic_items.append({
                "question": question,
                "concept": concept,
                "chapter_title": chapter_title,
                "section_title": section_title,
                "order": i + 1,
                "is_prerequisite": len(self.depends_on_me.get(cid, [])) > 0,
            })

        console.print(f"[green]Selected {len(diagnostic_items)} diagnostic questions[/]")
        console.print(f"[dim]  Covering {len(diagnostic_items)} concepts, ordered by prerequisites[/]")

        return diagnostic_items

    def _find_concept_location(self, concept_id: str) -> tuple[str, str]:
        """Find the chapter and section containing a concept."""
        for chapter in self.curriculum.chapters:
            for section in chapter.sections:
                for concept in section.concepts:
                    if concept.id == concept_id:
                        return chapter.title, section.title
        return "Unknown", "Unknown"

    def display_diagnostic_plan(self, items: list[dict]):
        """Display the diagnostic test plan in a rich table."""
        table = Table(title="Diagnostic Test Plan", show_lines=True)
        table.add_column("#", style="bold", width=3)
        table.add_column("Concept", style="cyan", width=25)
        table.add_column("Question", width=40)
        table.add_column("Difficulty", width=10)
        table.add_column("Type", width=12)
        table.add_column("Prereq?", width=8)

        for item in items:
            q = item["question"]
            c = item["concept"]
            table.add_row(
                str(item["order"]),
                c.name[:25],
                q.text[:40] + ("..." if len(q.text) > 40 else ""),
                q.difficulty,
                q.question_type,
                "Yes" if item["is_prerequisite"] else "",
            )

        console.print(table)


# ═══════════════════════════════════════════════════════════════════════════════
# BKT Initialization from Diagnostic Results
# ═══════════════════════════════════════════════════════════════════════════════

class DiagnosticProcessor:
    """
    Processes diagnostic test results to create initial StudentState.

    After the diagnostic test:
    1. Creates MasterySnapshot for EVERY concept (not just tested ones)
    2. Initializes BKT parameters based on responses
    3. Infers mastery for untested concepts from prerequisites
    4. Determines the student's starting point in the Knowledge Graph
    """

    def __init__(self, curriculum: Curriculum):
        self.curriculum = curriculum
        self.all_concepts = curriculum.get_all_concepts()
        self.concept_map = {c.id: c for c in self.all_concepts}

    def process_diagnostic(
        self,
        student_id: str,
        responses: list[DiagnosticResponse],
    ) -> StudentState:
        """
        Process diagnostic responses → create complete StudentState.

        Args:
            student_id: Unique student identifier.
            responses: List of DiagnosticResponse from the diagnostic test.

        Returns:
            StudentState with initialized mastery_snapshots for all concepts.
        """
        console.print(f"[bold cyan]Processing diagnostic for student: {student_id}[/]")

        now = datetime.now().isoformat()

        # Step 1: Create mastery snapshots for ALL concepts (default = unknown)
        snapshots: dict[str, MasterySnapshot] = {}
        for concept in self.all_concepts:
            snapshots[concept.id] = MasterySnapshot(
                concept_id=concept.id,
                concept_name=concept.name,
                mastery_estimate=0.1,  # Prior P(L₀)
                mastery_level=MasteryLevel.UNKNOWN,
                bkt_params=BKTParams(
                    p_know=0.1,
                    p_transit=0.1,
                    p_slip=0.1,
                    p_guess=0.25 if concept.questions and
                            any(q.question_type == "mcq" for q in concept.questions) else 0.1,
                ),
                timestamp=now,
            )

        # Step 2: Update snapshots with actual diagnostic responses
        for resp in responses:
            if resp.concept_id in snapshots:
                snap = snapshots[resp.concept_id]
                snap.update_bkt(resp.is_correct)

                # Factor in confidence
                if snap.attempts > 0:
                    old_avg = snap.confidence_avg
                    snap.confidence_avg = (old_avg * (snap.attempts - 1) + resp.confidence) / snap.attempts

        # Step 3: Infer mastery for UNTESTED concepts from prerequisites
        self._infer_from_prerequisites(snapshots)

        # Step 4: Determine starting point and classify
        weakest = sorted(
            [s for s in snapshots.values() if s.attempts > 0],
            key=lambda s: s.mastery_estimate,
        )
        strongest = sorted(
            [s for s in snapshots.values() if s.attempts > 0],
            key=lambda s: s.mastery_estimate,
            reverse=True,
        )

        # Starting point = weakest prerequisite concept
        entry_point = ""
        for snap in weakest:
            concept = self.concept_map.get(snap.concept_id)
            if concept and concept.prerequisites:
                # Check if prerequisites are mastered
                prereqs_ok = all(
                    snapshots.get(p, MasterySnapshot(concept_id=p)).mastery_estimate >= 0.6
                    for p in concept.prerequisites
                )
                if not prereqs_ok:
                    entry_point = snap.concept_id
                    break
            elif concept and not concept.prerequisites:
                entry_point = snap.concept_id
                break

        if not entry_point and weakest:
            entry_point = weakest[0].concept_id

        # Step 5: Build final StudentState
        state = StudentState(
            student_id=student_id,
            session_id=f"diag_{student_id}_{now[:10]}",
            mastery_snapshots=snapshots,
            diagnostic_complete=True,
            diagnostic_responses=responses,
            graph_entry_point=entry_point,
            weakest_concepts=[s.concept_id for s in weakest[:5]],
            strongest_concepts=[s.concept_id for s in strongest[:5]],
            created_at=now,
            last_updated=now,
        )

        # Display summary
        self._display_diagnostic_summary(state)

        return state

    def _infer_from_prerequisites(self, snapshots: dict[str, MasterySnapshot]):
        """
        Infer mastery for untested concepts based on tested prerequisites.

        Logic:
        - If a student masters all prerequisites of concept X,
          set X's prior P(L₀) higher (0.3 instead of 0.1)
        - If student failed prerequisites, set X's prior lower (0.05)
        """
        for concept in self.all_concepts:
            snap = snapshots.get(concept.id)
            if not snap or snap.attempts > 0:
                continue  # Skip already-tested concepts

            prereq_masteries = []
            for prereq_id in concept.prerequisites:
                prereq_snap = snapshots.get(prereq_id)
                if prereq_snap and prereq_snap.attempts > 0:
                    prereq_masteries.append(prereq_snap.mastery_estimate)

            if prereq_masteries:
                avg_prereq = sum(prereq_masteries) / len(prereq_masteries)
                if avg_prereq >= 0.7:
                    snap.mastery_estimate = 0.3  # Likely knows basics
                    snap.bkt_params.p_know = 0.3
                elif avg_prereq < 0.3:
                    snap.mastery_estimate = 0.05  # Likely struggles
                    snap.bkt_params.p_know = 0.05

    def _display_diagnostic_summary(self, state: StudentState):
        """Display diagnostic results in a rich table."""
        table = Table(title=f"Diagnostic Summary — {state.student_id}", show_lines=True)
        table.add_column("Concept", style="cyan", width=25)
        table.add_column("Mastery", width=10)
        table.add_column("Level", width=15)
        table.add_column("Correct", width=10)
        table.add_column("Confidence", width=10)

        tested = [s for s in state.mastery_snapshots.values() if s.attempts > 0]
        tested.sort(key=lambda s: s.mastery_estimate)

        for snap in tested:
            mastery_bar = self._mastery_bar(snap.mastery_estimate)
            level_color = {
                MasteryLevel.NOT_MASTERED: "red",
                MasteryLevel.LEARNING: "yellow",
                MasteryLevel.NEARLY: "blue",
                MasteryLevel.MASTERED: "green",
            }.get(snap.mastery_level, "white")

            table.add_row(
                snap.concept_name[:25],
                f"{snap.mastery_estimate:.0%}",
                f"[{level_color}]{snap.mastery_level.value}[/]",
                f"{snap.correct_count}/{snap.attempts}",
                f"{snap.confidence_avg:.1f}/5",
            )

        console.print(table)

        overall = state.overall_mastery()
        console.print(f"\n[bold]Overall Mastery: {overall:.0%}[/]")
        console.print(f"[bold]Entry Point: {state.graph_entry_point}[/]")

        if state.weakest_concepts:
            console.print(f"[red]Weakest: {', '.join(state.weakest_concepts[:3])}[/]")
        if state.strongest_concepts:
            console.print(f"[green]Strongest: {', '.join(state.strongest_concepts[:3])}[/]")

    @staticmethod
    def _mastery_bar(value: float, width: int = 10) -> str:
        filled = int(value * width)
        return "[green]" + "█" * filled + "[/][dim]" + "░" * (width - filled) + "[/]"


# ═══════════════════════════════════════════════════════════════════════════════
# Convenience Functions
# ═══════════════════════════════════════════════════════════════════════════════

def save_student_state(state: StudentState, output_dir: str = "data"):
    """Save StudentState to JSON."""
    os.makedirs(output_dir, exist_ok=True)
    path = os.path.join(output_dir, f"student_{state.student_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        f.write(state.model_dump_json(indent=2))
    console.print(f"[green]Saved student state: {path}[/]")


def load_student_state(student_id: str, data_dir: str = "data") -> StudentState | None:
    """Load StudentState from JSON."""
    path = os.path.join(data_dir, f"student_{student_id}.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return StudentState(**json.load(f))


# ═══════════════════════════════════════════════════════════════════════════════
# Main — Test with sample data
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    # Load curriculum
    with open("data/curriculum.json", "r", encoding="utf-8") as f:
        curriculum = Curriculum(**json.load(f))

    # Select diagnostic questions
    selector = DiagnosticSelector(curriculum)
    items = selector.select_diagnostic_questions(max_questions=10)
    selector.display_diagnostic_plan(items)

    # Simulate diagnostic responses
    print("\n--- Simulating diagnostic responses ---\n")
    responses = []
    for item in items:
        is_correct = random.random() > 0.4  # 60% chance correct
        responses.append(DiagnosticResponse(
            question_id=item["question"].id,
            concept_id=item["concept"].id,
            is_correct=is_correct,
            confidence=random.randint(1, 5),
            time_spent_ms=random.randint(30000, 120000),
        ))

    # Process diagnostic
    processor = DiagnosticProcessor(curriculum)
    state = processor.process_diagnostic("student_001", responses)

    # Save
    save_student_state(state)
