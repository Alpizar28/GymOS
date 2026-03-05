"""Validation tests for API request models and helper guards."""

import pytest
from pydantic import ValidationError

from src.api.routes import (
    CompleteSessionRequest,
    DayOptionCreate,
    ManualSet,
    ProtectionRequest,
    TodayLogRequest,
    _classify_training_type,
)


def test_day_option_rejects_unknown_fields():
    with pytest.raises(ValidationError):
        DayOptionCreate(focus="Push", rules={}, injected="x")


def test_manual_set_rejects_invalid_set_type():
    with pytest.raises(ValidationError):
        ManualSet(weight=135, reps=8, set_type="cluster")


def test_manual_set_rejects_out_of_range_values():
    with pytest.raises(ValidationError):
        ManualSet(weight=-1)

    with pytest.raises(ValidationError):
        ManualSet(reps=250)

    with pytest.raises(ValidationError):
        ManualSet(rir=11)


def test_today_log_request_rejects_blank_day_name_after_strip():
    with pytest.raises(ValidationError):
        TodayLogRequest(
            day_name="   ",
            exercises=[
                {
                    "name": "Bench Press",
                    "sets": [{"index": 0, "actual_weight": 135, "actual_reps": 8, "actual_rir": 2}],
                }
            ],
        )


def test_complete_session_request_validates_fatigue_range():
    with pytest.raises(ValidationError):
        CompleteSessionRequest(workout_id=10, fatigue=0)

    with pytest.raises(ValidationError):
        CompleteSessionRequest(workout_id=10, fatigue=10.5)


def test_protection_request_validates_severity_range():
    with pytest.raises(ValidationError):
        ProtectionRequest(muscle_group="quads", severity=0)

    with pytest.raises(ValidationError):
        ProtectionRequest(muscle_group="quads", severity=11)


@pytest.mark.parametrize(
    ("template_name", "expected"),
    [
        ("Push_Heavy", "push"),
        ("pull day", "pull"),
        ("Legs Focus", "legs"),
        ("Push Pull Mix", "custom"),
        ("", "custom"),
        (None, "custom"),
    ],
)
def test_classify_training_type(template_name: str | None, expected: str):
    assert _classify_training_type(template_name) == expected
