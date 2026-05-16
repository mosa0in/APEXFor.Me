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


# ═══════════════════════════════════════════════════════════════════════════
# DKT-style Update (pyKT equivalent — manual equations, no external ML deps)
# ═══════════════════════════════════════════════════════════════════════════

def dkt_update(
    hidden_state: float,
    weighted_correct: float,
    concept_difficulty: float = 0.5,
    interaction_weight: float = 1.0,
) -> float:
    """
    Deep Knowledge Tracing approximation using logistic update (DKT/AKT style).

    Equations (DKT simplified for scalar state):
      input    = weighted_correct × interaction_weight
      forget   = sigmoid(-concept_difficulty × 2)          # harder = slower learning
      input_g  = sigmoid(input - 0.5)                       # gate: was it a real signal?
      h_new    = forget × hidden_state + (1 - forget) × input_g
      p_know   = sigmoid(h_new × 4 - 2)                     # scale to 0-1 range

    Advantage over BKT: captures forgetting + difficulty-weighted gating.
    """
    import math

    def sigmoid(x: float) -> float:
        return 1.0 / (1.0 + math.exp(-max(-500.0, min(500.0, x))))

    forget_gate = sigmoid(-concept_difficulty * 2.0)
    input_gate = sigmoid((weighted_correct * interaction_weight) - 0.5)
    h_new = forget_gate * hidden_state + (1.0 - forget_gate) * input_gate
    p_know = sigmoid(h_new * 4.0 - 2.0)
    return max(0.0, min(1.0, p_know))


# ═══════════════════════════════════════════════════════════════════════════
# pyhgf / Hierarchical Gaussian Filter — Predictive Coding approximation
# ═══════════════════════════════════════════════════════════════════════════

def hgf_update(
    mu1: float,
    pi1: float,
    mu2: float,
    pi2: float,
    observation: float,
    kappa: float = 1.0,
    omega: float = -4.0,
) -> tuple[float, float, float, float]:
    """
    Two-level Hierarchical Gaussian Filter update (pyhgf default equations).

    Level 1: fast-changing belief (mastery estimate)
    Level 2: slow-changing volatility (learning rate)

    Equations (Mathys et al. 2011):
      pi1_hat = 1 / (1/pi1 + exp(kappa * mu2 + omega))
      delta1  = observation - sigmoid(mu1)
      pi1_new = pi1_hat + 1                    # precision increases with evidence
      mu1_new = mu1 + delta1 / pi1_new

      pi2_hat = 1 / (1/pi2 + exp(omega))
      delta2  = (1/pi1_hat + (delta1**2 - 1/pi1_hat)) * kappa**2/2 * pi2/pi1_hat
      pi2_new = pi2_hat + kappa**2/2 * pi2/pi1_hat * (pi2/pi1_hat - delta2)
      mu2_new = mu2 + kappa/2 * pi2_hat/pi1_hat * delta1**2

    Returns:
        (mu1_new, pi1_new, mu2_new, pi2_new) — updated beliefs + precisions
    """
    import math

    def sigmoid(x: float) -> float:
        return 1.0 / (1.0 + math.exp(-max(-500.0, min(500.0, x))))

    # Level 1 update
    pi1_hat = 1.0 / (1.0 / max(pi1, 1e-6) + math.exp(kappa * mu2 + omega))
    delta1 = observation - sigmoid(mu1)
    pi1_new = pi1_hat + 1.0
    mu1_new = mu1 + delta1 / max(pi1_new, 1e-6)

    # Level 2 update
    pi2_hat = 1.0 / (1.0 / max(pi2, 1e-6) + math.exp(omega))
    w2 = kappa ** 2 / 2.0 * (pi2 / max(pi1_hat, 1e-6))
    delta2 = w2 * ((1.0 / max(pi1_hat, 1e-6) + delta1 ** 2) * pi1_hat - 1.0)
    pi2_new = max(1e-6, pi2_hat + w2 * (w2 - delta2))
    mu2_new = mu2 + kappa / 2.0 * (pi2_hat / max(pi1_hat, 1e-6)) * delta1 ** 2

    return (
        max(0.0, min(1.0, sigmoid(mu1_new))),
        max(1e-6, pi1_new),
        mu2_new,
        max(1e-6, pi2_new),
    )


# ═══════════════════════════════════════════════════════════════════════════
# GNN-enhanced mastery (DGKT / LPKT-style prerequisite propagation)
# ═══════════════════════════════════════════════════════════════════════════

def gnn_propagate_mastery(
    concept_mastery: Dict[str, float],
    prereq_edges: list[tuple[str, str]],
    dampening: float = 0.3,
    iterations: int = 2,
) -> Dict[str, float]:
    """
    Graph Neural Network-style mastery propagation (DGKT/LPKT approximation).

    Propagates mastery signals through prerequisite edges so that high mastery
    of a prerequisite boosts the posterior estimate of dependent concepts.

    Equation per iteration:
      h_v = (1-d) × h_v + d × mean(h_u for u in prereqs(v))

    Args:
        concept_mastery: {concept_id: mastery_estimate}
        prereq_edges: list of (prereq_id, concept_id) edges
        dampening: how much prerequisite mastery bleeds into the dependent
        iterations: number of message-passing rounds

    Returns:
        Updated {concept_id: mastery_estimate} dict (original not mutated)
    """
    updated = dict(concept_mastery)
    for _ in range(iterations):
        new_vals: Dict[str, list] = {cid: [] for cid in updated}
        for prereq_id, concept_id in prereq_edges:
            if prereq_id in updated and concept_id in new_vals:
                new_vals[concept_id].append(updated[prereq_id])
        for concept_id, neighbor_vals in new_vals.items():
            if neighbor_vals:
                avg_neighbor = sum(neighbor_vals) / len(neighbor_vals)
                current = updated[concept_id]
                updated[concept_id] = (1.0 - dampening) * current + dampening * avg_neighbor
    return updated


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
