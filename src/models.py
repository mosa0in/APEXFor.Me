"""
APEX Curriculum Intelligence — Data Models (Updated)
Adds mastery tracking, diagnostic sessions, and student state to the curriculum hierarchy.

Hierarchy: Book → Chapter → Section → Concept → Question
Tracking:  Student → MasterySnapshot → DiagnosticSession → Response
"""

from __future__ import annotations
from pydantic import BaseModel, Field
from enum import Enum
from datetime import datetime


# ═══════════════════════════════════════════════════════════════════════════════
# Curriculum Structure Models
# ═══════════════════════════════════════════════════════════════════════════════

class Question(BaseModel):
    """A single question or exercise that tests a concept."""
    id: str = Field(description="Unique question identifier, e.g. q1_1_1")
    text: str = Field(description="Full question text")
    difficulty: str = Field(default="medium", description="easy | medium | hard")
    question_type: str = Field(default="calculation", description="mcq | calculation | proof | conceptual")
    answer_hint: str = Field(default="", description="Brief answer or approach hint")
    correct_answer: str = Field(default="", description="The correct answer")
    options: list[str] = Field(default_factory=list, description="MCQ options if applicable")
    concept_id: str = Field(default="", description="Back-reference to parent concept")
    is_diagnostic: bool = Field(default=False, description="Suitable for diagnostic test?")
    bloom_level: int = Field(default=2, description="Bloom's taxonomy level 1-6")


class Concept(BaseModel):
    """A teachable concept or topic within a section."""
    id: str = Field(description="Unique concept identifier, e.g. con1_1_1")
    name: str = Field(description="Concept name, e.g. 'Limits of Functions'")
    description: str = Field(description="Detailed explanation of the concept")
    prerequisites: list[str] = Field(default_factory=list, description="IDs of prerequisite concepts")
    key_formulas: list[str] = Field(default_factory=list, description="Important formulas")
    questions: list[Question] = Field(default_factory=list, description="Questions testing this concept")
    is_core: bool = Field(default=True, description="Is this a core/main concept for diagnostics?")
    difficulty_level: float = Field(default=0.5, description="Concept difficulty 0.0-1.0")


class Section(BaseModel):
    """A section within a chapter."""
    id: str = Field(description="Unique section identifier")
    title: str = Field(description="Section title")
    page_start: int = Field(default=0, description="Starting page in PDF")
    concepts: list[Concept] = Field(default_factory=list)


class Chapter(BaseModel):
    """A chapter within a book."""
    id: str = Field(description="Unique chapter identifier")
    number: int = Field(description="Chapter number")
    title: str = Field(description="Chapter title")
    summary: str = Field(default="")
    sections: list[Section] = Field(default_factory=list)


class Curriculum(BaseModel):
    """Root model — the entire textbook."""
    book_title: str = Field(description="Title of the textbook")
    authors: list[str] = Field(default_factory=list)
    edition: str = Field(default="")
    language: str = Field(default="en", description="en, ar, mixed")
    chapters: list[Chapter] = Field(default_factory=list)

    @property
    def total_concepts(self) -> int:
        return sum(len(sec.concepts) for ch in self.chapters for sec in ch.sections)

    @property
    def total_questions(self) -> int:
        return sum(len(con.questions) for ch in self.chapters for sec in ch.sections for con in sec.concepts)

    def get_all_concepts(self) -> list[Concept]:
        """Flat list of all concepts across the curriculum."""
        return [con for ch in self.chapters for sec in ch.sections for con in sec.concepts]

    def get_concept_by_id(self, concept_id: str) -> Concept | None:
        """Find a concept by its ID."""
        for con in self.get_all_concepts():
            if con.id == concept_id:
                return con
        return None

    def get_core_concepts(self) -> list[Concept]:
        """Get only core concepts suitable for diagnostic testing."""
        return [c for c in self.get_all_concepts() if c.is_core]


# ═══════════════════════════════════════════════════════════════════════════════
# Mastery & Diagnostic Models
# ═══════════════════════════════════════════════════════════════════════════════

class MasteryLevel(str, Enum):
    """Discrete mastery classification."""
    UNKNOWN = "unknown"          # Not yet tested
    NOT_MASTERED = "not_mastered"  # P(know) < 0.3
    LEARNING = "learning"        # 0.3 <= P(know) < 0.6
    NEARLY = "nearly_mastered"   # 0.6 <= P(know) < 0.8
    MASTERED = "mastered"        # P(know) >= 0.8


class BKTParams(BaseModel):
    """Bayesian Knowledge Tracing parameters for a concept."""
    p_know: float = Field(default=0.1, description="P(L₀) — prior probability of knowing")
    p_transit: float = Field(default=0.1, description="P(T) — probability of learning per opportunity")
    p_slip: float = Field(default=0.1, description="P(S) — probability of slipping (knows but wrong)")
    p_guess: float = Field(default=0.25, description="P(G) — probability of guessing (doesn't know but right)")


class MasterySnapshot(BaseModel):
    """
    A snapshot of a student's mastery of a single concept at a point in time.
    This is the CORE data structure that connects diagnostic → tracking → action.
    """
    concept_id: str
    concept_name: str = ""
    mastery_estimate: float = Field(default=0.1, description="P(know) from BKT, 0.0-1.0")
    mastery_level: MasteryLevel = Field(default=MasteryLevel.UNKNOWN)
    bkt_params: BKTParams = Field(default_factory=BKTParams)
    attempts: int = Field(default=0)
    correct_count: int = Field(default=0)
    last_response_correct: bool | None = Field(default=None)
    confidence_avg: float = Field(default=0.0, description="Average student confidence 1-5")
    timestamp: str = Field(default="")

    def classify(self) -> MasteryLevel:
        """Classify mastery level from estimate."""
        if self.attempts == 0:
            return MasteryLevel.UNKNOWN
        elif self.mastery_estimate < 0.3:
            return MasteryLevel.NOT_MASTERED
        elif self.mastery_estimate < 0.6:
            return MasteryLevel.LEARNING
        elif self.mastery_estimate < 0.8:
            return MasteryLevel.NEARLY
        else:
            return MasteryLevel.MASTERED

    def update_bkt(self, is_correct: bool):
        """
        Update mastery estimate using Bayesian Knowledge Tracing.

        BKT update equations:
        If correct: P(L|correct) = P(L) * (1-P(S)) / [P(L)*(1-P(S)) + (1-P(L))*P(G)]
        If wrong:   P(L|wrong)   = P(L) * P(S) / [P(L)*P(S) + (1-P(L))*(1-P(G))]
        After:      P(L_new)     = P(L|obs) + (1 - P(L|obs)) * P(T)
        """
        p_l = self.mastery_estimate
        p_s = self.bkt_params.p_slip
        p_g = self.bkt_params.p_guess
        p_t = self.bkt_params.p_transit

        if is_correct:
            p_l_given_obs = (p_l * (1 - p_s)) / (p_l * (1 - p_s) + (1 - p_l) * p_g)
        else:
            p_l_given_obs = (p_l * p_s) / (p_l * p_s + (1 - p_l) * (1 - p_g))

        # Learning transition
        self.mastery_estimate = p_l_given_obs + (1 - p_l_given_obs) * p_t
        self.mastery_estimate = max(0.01, min(0.99, self.mastery_estimate))

        self.attempts += 1
        if is_correct:
            self.correct_count += 1
        self.last_response_correct = is_correct
        self.mastery_level = self.classify()
        self.timestamp = datetime.now().isoformat()


class DiagnosticResponse(BaseModel):
    """A single student response during the diagnostic test."""
    question_id: str
    concept_id: str
    selected_answer: str = ""
    is_correct: bool
    confidence: int = Field(default=3, ge=1, le=5, description="Student confidence 1-5")
    time_spent_ms: int = Field(default=0, description="Time spent in milliseconds")
    student_explanation: str = Field(default="", description="How the student explains their reasoning")


class StudentState(BaseModel):
    """
    Complete state of a student in the system.
    Created after diagnostic test, updated after every interaction.
    """
    student_id: str
    session_id: str = ""
    mastery_snapshots: dict[str, MasterySnapshot] = Field(
        default_factory=dict,
        description="concept_id → MasterySnapshot"
    )
    diagnostic_complete: bool = Field(default=False)
    diagnostic_responses: list[DiagnosticResponse] = Field(default_factory=list)
    graph_entry_point: str = Field(default="", description="Concept ID where student starts in KG")
    weakest_concepts: list[str] = Field(default_factory=list, description="Sorted weakest → strongest")
    strongest_concepts: list[str] = Field(default_factory=list)
    created_at: str = Field(default="")
    last_updated: str = Field(default="")

    def get_mastery(self, concept_id: str) -> float:
        """Get mastery estimate for a concept (0.1 if unknown)."""
        snap = self.mastery_snapshots.get(concept_id)
        return snap.mastery_estimate if snap else 0.1

    def get_weakest(self, n: int = 5) -> list[MasterySnapshot]:
        """Get n weakest concepts sorted by mastery."""
        tested = [s for s in self.mastery_snapshots.values() if s.attempts > 0]
        return sorted(tested, key=lambda s: s.mastery_estimate)[:n]

    def get_unmastered(self) -> list[MasterySnapshot]:
        """Get all concepts not yet mastered (P(know) < 0.8)."""
        return [s for s in self.mastery_snapshots.values()
                if s.mastery_estimate < 0.8 and s.attempts > 0]

    def overall_mastery(self) -> float:
        """Average mastery across all tested concepts."""
        tested = [s.mastery_estimate for s in self.mastery_snapshots.values() if s.attempts > 0]
        return sum(tested) / len(tested) if tested else 0.0
