"""Tests for the deterministic progression engine."""

import json
from dataclasses import dataclass, field

import pytest

from src.services.progression_engine import (
    ProgressionAction,
    evaluate_anchor,
    _should_deload,
)


@dataclass
class MockAnchorTarget:
    """Lightweight mock that mirrors AnchorTarget attributes for testing."""

    exercise_id: int = 1
    target_weight: float = 185.0
    target_reps_min: int = 5
    target_reps_max: int = 8
    rule_profile: str = ""
    last_success_at: object = None
    streak: int = 0
    last_rir: int | None = None
    status: str = "active"


def _make_target(
    weight: float = 185.0,
    reps_min: int = 5,
    reps_max: int = 8,
    increment: int = 5,
    deload_pct: float = 0.10,
    consolidation_sessions: int = 2,
) -> MockAnchorTarget:
    """Create a mock AnchorTarget for testing."""
    return MockAnchorTarget(
        target_weight=weight,
        target_reps_min=reps_min,
        target_reps_max=reps_max,
        rule_profile=json.dumps({
            "increment_lbs": increment,
            "deload_pct": deload_pct,
            "consolidation_sessions": consolidation_sessions,
            "rep_range": [reps_min, reps_max],
        }),
    )


class TestEvaluateAnchor:
    """Test the core evaluate_anchor function."""

    def test_rir_2_plus_increases_weight(self):
        """RIR >= 2 → weight += increment."""
        target = _make_target(weight=185.0, increment=5)
        result = evaluate_anchor(
            target=target,
            exercise_name="Bench Press",
            top_set_reps=6,
            top_set_rir=2,
            recent_rep_counts=[6, 6, 6],
        )
        assert result.action == ProgressionAction.INCREASE_WEIGHT
        assert result.new_weight == 190.0
        assert result.old_weight == 185.0

    def test_rir_3_also_increases_weight(self):
        """RIR 3 should also trigger weight increase."""
        target = _make_target(weight=200.0, increment=5)
        result = evaluate_anchor(
            target=target,
            exercise_name="Squat",
            top_set_reps=8,
            top_set_rir=3,
            recent_rep_counts=[8, 8],
        )
        assert result.action == ProgressionAction.INCREASE_WEIGHT
        assert result.new_weight == 205.0

    def test_rir_1_increases_reps(self):
        """RIR == 1 → same weight, reps += 1."""
        target = _make_target(weight=185.0, reps_max=8)
        result = evaluate_anchor(
            target=target,
            exercise_name="Bench Press",
            top_set_reps=8,
            top_set_rir=1,
            recent_rep_counts=[8, 8],
        )
        assert result.action == ProgressionAction.INCREASE_REPS
        assert result.new_weight == 185.0
        assert result.new_reps_range == (5, 9)

    def test_rir_0_consolidates(self):
        """RIR == 0 → consolidate at current weight/reps."""
        target = _make_target(weight=185.0)
        result = evaluate_anchor(
            target=target,
            exercise_name="Bench Press",
            top_set_reps=5,
            top_set_rir=0,
            recent_rep_counts=[5, 5],  # stable → won't trigger deload
        )
        assert result.action == ProgressionAction.CONSOLIDATE
        assert result.new_weight == 185.0
        assert result.new_reps_range == (5, 8)

    def test_two_declining_sessions_deloads(self):
        """2 consecutive sessions with fewer reps → deload."""
        target = _make_target(weight=200.0, deload_pct=0.10, consolidation_sessions=2)
        result = evaluate_anchor(
            target=target,
            exercise_name="Squat",
            top_set_reps=4,
            top_set_rir=2,
            recent_rep_counts=[6, 5],  # declining
        )
        assert result.action == ProgressionAction.DELOAD
        assert result.new_weight == 180.0  # 200 * 0.9 = 180

    def test_three_declining_sessions_deloads(self):
        """3 sessions declining with threshold 2 should still deload."""
        target = _make_target(weight=200.0, deload_pct=0.10, consolidation_sessions=2)
        result = evaluate_anchor(
            target=target,
            exercise_name="Squat",
            top_set_reps=3,
            top_set_rir=2,
            recent_rep_counts=[8, 6, 5],  # last 2 are declining
        )
        assert result.action == ProgressionAction.DELOAD

    def test_no_data_returns_no_data(self):
        """No set data → NO_DATA action."""
        target = _make_target()
        result = evaluate_anchor(
            target=target,
            exercise_name="Bench Press",
            top_set_reps=None,
            top_set_rir=None,
            recent_rep_counts=[],
        )
        assert result.action == ProgressionAction.NO_DATA
        assert result.new_weight == result.old_weight

    def test_deload_rounds_down_to_nearest_5(self):
        """Deload weight should round down to nearest 5 lbs."""
        target = _make_target(weight=193.0, deload_pct=0.10, consolidation_sessions=2)
        result = evaluate_anchor(
            target=target,
            exercise_name="Bench Press",
            top_set_reps=4,
            top_set_rir=2,
            recent_rep_counts=[6, 5],
        )
        assert result.action == ProgressionAction.DELOAD
        # 193 * 0.9 = 173.7 → round down to 170
        assert result.new_weight == 170.0


class TestShouldDeload:
    """Test the _should_deload helper."""

    def test_not_enough_data(self):
        assert _should_deload([], 2) is False
        assert _should_deload([6], 2) is False

    def test_declining(self):
        assert _should_deload([8, 7], 2) is True
        assert _should_deload([10, 8, 6], 3) is True

    def test_stable(self):
        assert _should_deload([8, 8], 2) is False

    def test_increasing(self):
        assert _should_deload([6, 8], 2) is False

    def test_only_last_n_matters(self):
        # The last 2 are increasing, despite earlier decline
        assert _should_deload([10, 8, 6, 7], 2) is False
