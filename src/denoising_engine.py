"""
APEX Denoising Engine — Graph-aware noise filtering
Calculates weighted_correct for each interaction based on:
- Confidence × Answer matrix
- Hint/explanation usage
- Rephrase count
- Graph mismatch (prerequisite check)
"""
from typing import Optional


# ═══════════════════════════════════════════════════════════════════════════
# Denoising Weight Multipliers (from APEX Spec §4.3)
# ═══════════════════════════════════════════════════════════════════════════

def compute_weighted_correct(
    correct: bool,
    confidence_level: int = 0,       # 1-5
    hint_used: bool = False,
    explanation_viewed: bool = False,
    question_regenerated: int = 0,
    prereq_mastery: Optional[float] = None,  # mastery of prerequisite concepts
) -> float:
    """
    Compute weighted_correct ∈ [0.0, 1.0] — graph-aware noise filtering.
    
    This replaces binary correct/wrong with a continuous signal that accounts for:
    - Guessing (high correct + low confidence)
    - Strong wrong signals (high confidence + wrong)
    - Help usage (hints reduce weight)
    - Explanation viewing (excludes from mastery calc)
    - Graph mismatch (correct on advanced concept but failing prerequisites)
    """
    # Base: 1.0 if correct, 0.0 if wrong
    base = 1.0 if correct else 0.0
    
    # Explanation viewed = exclude entirely (student saw the answer)
    if explanation_viewed:
        return 0.0
    
    multiplier = 1.0
    
    # Confidence × Answer Matrix (Spec §4.3)
    if confidence_level >= 4:
        if correct:
            # True mastery — high confidence + correct → strong positive signal
            multiplier *= 1.0
        else:
            # Conceptual error ★ — confident but wrong → strongest signal for remediation
            multiplier *= 1.3  # Amplify the wrong signal
    elif confidence_level <= 2:
        if correct:
            # Likely guess — correct but no confidence → weak positive signal
            multiplier *= 0.3
        else:
            # Knowledge gap — low confidence + wrong → expected
            multiplier *= 0.8
    # confidence 3 = neutral, multiplier stays 1.0
    
    # Hint used → reduced weight (got help)
    if hint_used:
        multiplier *= 0.5
    
    # Question regenerated 3 times → reduced weight
    if question_regenerated >= 3:
        multiplier *= 0.6
    elif question_regenerated >= 1:
        multiplier *= 0.8
    
    # Graph mismatch: correct on this concept but failing prerequisites
    if prereq_mastery is not None and prereq_mastery < 0.4 and correct:
        # Suspicious: how can you get advanced right if basics are wrong?
        multiplier *= 0.2
    
    # Compute final weighted_correct
    if correct:
        return min(1.0, base * multiplier)
    else:
        # For wrong answers, weighted_correct stays low but scaled by multiplier
        # Higher multiplier on wrong = stronger "wrong" signal (closer to 0)
        return max(0.0, base * multiplier)


def classify_confidence_answer(correct: bool, confidence: int) -> str:
    """
    Classify the confidence × answer combination (Spec §4.3 matrix).
    Returns: 'true_mastery' | 'conceptual_error' | 'lucky_guess' | 'knowledge_gap'
    """
    if confidence >= 4:
        return 'true_mastery' if correct else 'conceptual_error'
    elif confidence <= 2:
        return 'lucky_guess' if correct else 'knowledge_gap'
    else:
        return 'true_mastery' if correct else 'knowledge_gap'
