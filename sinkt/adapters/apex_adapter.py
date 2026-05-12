"""
SINKT — APEX Diagnostic Adapter
Converts real student session data from APEX Diagnostic into SINKT training format.
This enables Fine-Tuning on ACTUAL student performance data.

Input: APEX sessions CSV (from exportExcel.ts)
Output: SINKT-compatible history_{split}.pkl files
"""

import csv
import json
import os
import pickle
import random
from collections import defaultdict
from rich.console import Console

console = Console(force_terminal=True)


class APEXToSINKT:
    """
    Converts APEX Diagnostic session exports into SINKT training data.

    APEX CSV columns (from SessionContext.tsx):
    - sessionId, questionId, conceptId, conceptName, sectionType,
      questionType, selectedAnswer, selectedIndex, isCorrect,
      confidence, difficulty, reflection, timeSpent,
      usedHint, usedCoach, coachHelpType, usedRephrase,
      regenerationReason, restRequested, inputModality, timestamp
    """

    def __init__(self, concept_mapping_path: str = "data/curriculum.json"):
        """
        Args:
            concept_mapping_path: Path to curriculum JSON for concept ID mapping.
        """
        self.concept_id_map = {}  # APEX conceptId -> SINKT integer index
        self.concept_names = {}

        if os.path.exists(concept_mapping_path):
            with open(concept_mapping_path, "r", encoding="utf-8") as f:
                curriculum = json.load(f)
            self._build_concept_map(curriculum)

    def _build_concept_map(self, curriculum: dict):
        """Map APEX concept IDs (e.g., 'CON_ALG_001') to SINKT integer indices."""
        idx = 1  # SINKT uses 1-indexed
        for chapter in curriculum.get("chapters", []):
            for section in chapter.get("sections", []):
                for concept in section.get("concepts", []):
                    apex_id = concept.get("id", "")
                    self.concept_id_map[apex_id] = idx
                    self.concept_names[apex_id] = concept.get("name", "")
                    idx += 1

    def load_sessions(self, csv_path: str) -> dict:
        """
        Load APEX session CSV and group interactions by session.

        Returns:
            Dict[session_id] -> list of interaction records
        """
        sessions = defaultdict(list)

        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                session_id = row.get("sessionId", "unknown")
                sessions[session_id].append({
                    "questionId": int(row.get("questionId", 0)),
                    "conceptId": row.get("conceptId", ""),
                    "conceptName": row.get("conceptName", ""),
                    "isCorrect": row.get("isCorrect", "false").lower() == "true",
                    "confidence": int(row.get("confidence", 3)),
                    "difficulty": int(row.get("difficulty", 3)),
                    "timeSpent": int(row.get("timeSpent", 0)),
                    "usedHint": row.get("usedHint", "false").lower() == "true",
                    "usedCoach": row.get("usedCoach", "false").lower() == "true",
                })

        console.print(f"[green]✅ Loaded {len(sessions)} sessions from APEX[/]")
        return dict(sessions)

    def convert_to_sinkt_histories(
        self,
        sessions: dict,
        output_dir: str = "data/sinkt_data",
        train_ratio: float = 0.7,
        valid_ratio: float = 0.15,
    ):
        """
        Convert APEX sessions to SINKT history format and split into train/valid/test.

        SINKT history format:
            (seq_length, [(question_id, [concept_ids], response, concept_text), ...])
        """
        os.makedirs(output_dir, exist_ok=True)
        all_histories = []

        for session_id, interactions in sessions.items():
            if len(interactions) < 3:
                continue  # Skip very short sessions

            records = []
            for interaction in interactions:
                concept_id = interaction["conceptId"]
                sinkt_concept = self.concept_id_map.get(concept_id, 1)
                sinkt_question = interaction["questionId"]

                records.append((
                    sinkt_question,
                    [sinkt_concept],
                    1 if interaction["isCorrect"] else 0,
                    interaction["conceptName"],
                ))

            all_histories.append((len(records), records))

        # Shuffle and split
        random.shuffle(all_histories)
        n = len(all_histories)
        n_train = int(n * train_ratio)
        n_valid = int(n * valid_ratio)

        splits = {
            "train": all_histories[:n_train],
            "valid": all_histories[n_train:n_train + n_valid],
            "test": all_histories[n_train + n_valid:],
        }

        for split_name, data in splits.items():
            path = os.path.join(output_dir, f"history_{split_name}.pkl")
            with open(path, "wb") as f:
                pickle.dump(data, f)
            console.print(f"[green]  📦 {split_name}: {len(data)} sessions[/]")

        console.print(f"[bold green]✅ APEX → SINKT conversion complete![/]")
        return splits


if __name__ == "__main__":
    import sys

    csv_path = sys.argv[1] if len(sys.argv) > 1 else "data/apex_sessions.csv"

    adapter = APEXToSINKT()
    sessions = adapter.load_sessions(csv_path)
    adapter.convert_to_sinkt_histories(sessions)
