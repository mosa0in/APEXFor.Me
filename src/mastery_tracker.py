"""
APEX Mastery Tracker — BKT Engine
Implements Bayesian Knowledge Tracing with denoised data.
Updates mastery_estimate after each interaction.

BKT Parameters (from APEX Spec §4.3):
  L0 = 0.3   (initial mastery)
  T  = 0.15  (transition/learning rate)
  G  = 0.25  (guess probability)
  S  = 0.10  (slip probability)
  Gate = 0.75 (mastery threshold)
"""
from typing import Dict, Optional, Tuple


# ═══════════════════════════════════════════════════════════════════════════
# BKT Parameters
# ═══════════════════════════════════════════════════════════════════════════

L0 = 0.3    # Initial mastery estimate
T  = 0.15   # Transition rate (natural learning)
G  = 0.25   # Guess probability
S  = 0.10   # Slip probability
MASTERY_GATE = 0.75  # Threshold for concept mastery


def bkt_update(
    current_mastery: float,
    weighted_correct: float,
    transition_rate: float = T,
    guess_rate: float = G,
    slip_rate: float = S,
) -> float:
    """
    Update mastery estimate using BKT formula (Spec §4.3).
    
    Steps:
    1. P(correct) = L × (1-S) + (1-L) × G
    2. If w > 0.5: L = L×(1-S) / P_correct
       Else:       L = L×S / (1-P_correct)
    3. L_final = L + T × (1-L)
    
    Args:
        current_mastery: Current L value (0-1)
        weighted_correct: Denoised correctness signal (0-1), NOT binary
        transition_rate: T parameter
        guess_rate: G parameter
        slip_rate: S parameter
    
    Returns:
        Updated mastery estimate (0-1)
    """
    L = max(0.01, min(0.99, current_mastery))
    
    # Step 1: P(correct) given current mastery
    p_correct = L * (1 - slip_rate) + (1 - L) * guess_rate
    p_correct = max(0.01, min(0.99, p_correct))
    
    # Step 2: Bayesian update based on weighted_correct
    if weighted_correct > 0.5:
        # Evidence of knowing
        L_posterior = (L * (1 - slip_rate)) / p_correct
    else:
        # Evidence of not knowing
        L_posterior = (L * slip_rate) / (1 - p_correct)
    
    L_posterior = max(0.01, min(0.99, L_posterior))
    
    # Step 3: Add natural learning (transition)
    L_final = L_posterior + transition_rate * (1 - L_posterior)
    
    return max(0.0, min(1.0, L_final))


def check_mastery_gate(mastery: float) -> bool:
    """Check if mastery exceeds the gate threshold (0.75)."""
    return mastery >= MASTERY_GATE


def get_mastery_level(mastery: float) -> str:
    """Classify mastery into human-readable level."""
    if mastery >= 0.75:
        return 'proficient'
    elif mastery >= 0.50:
        return 'developing'
    elif mastery >= 0.25:
        return 'novice'
    else:
        return 'beginner'


def compute_next_question_score(
    question_difficulty: float,
    student_mastery: float,
    pattern_accuracy: Dict[str, float],
    question_pattern: str,
    prereq_coverage: float,
) -> float:
    """
    Score a candidate question for adaptive selection (Spec §4.3).
    
    score(q) = difficulty_fit × 0.4 + pattern_gap × 0.3 + prereq_coverage × 0.3
    
    Args:
        question_difficulty: 0-1 difficulty of the question
        student_mastery: 0-1 current mastery estimate
        pattern_accuracy: {pattern: accuracy} dict, e.g. {"MCQ": 0.8, "essay": 0.4}
        question_pattern: pattern of this question (e.g. "MCQ")
        prereq_coverage: 0-1 how well prerequisites are covered
    
    Returns:
        Score (higher = better candidate)
    """
    # difficulty_fit: 1 - |q.diff - mastery| — closer difficulty = better
    difficulty_fit = 1.0 - abs(question_difficulty - student_mastery)
    
    # pattern_gap: prioritize weak patterns
    pattern_acc = pattern_accuracy.get(question_pattern, 0.5)
    pattern_gap = 1.0 - pattern_acc  # Lower accuracy = higher gap = higher priority
    
    # Weighted score
    score = (difficulty_fit * 0.4) + (pattern_gap * 0.3) + (prereq_coverage * 0.3)
    
    return max(0.0, min(1.0, score))
