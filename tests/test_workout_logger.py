"""Tests for the workout logger parser."""

import pytest

from src.services.workout_logger import parse_exercise_line


class TestParseExerciseLine:
    """Test the regex-based exercise line parser."""

    def test_simple_shorthand(self):
        """Bench Press 185x6x3 → 3 sets."""
        result = parse_exercise_line("Bench Press 185x6x3")
        assert result is not None
        name, sets = result
        assert name == "Bench Press"
        assert len(sets) == 3
        for s in sets:
            assert s["weight"] == 185.0
            assert s["reps"] == 6
            assert s["set_type"] == "normal"

    def test_multiple_sets_comma(self):
        """Multiple sets separated by commas."""
        result = parse_exercise_line("Chest Fly 170x12, 160x12, 150x15")
        assert result is not None
        name, sets = result
        assert name == "Chest Fly"
        assert len(sets) == 3
        assert sets[0]["weight"] == 170.0
        assert sets[0]["reps"] == 12
        assert sets[1]["weight"] == 160.0
        assert sets[2]["weight"] == 150.0
        assert sets[2]["reps"] == 15

    def test_with_rir(self):
        """Set with RIR notation."""
        result = parse_exercise_line("Squat 225x5 RIR2")
        assert result is not None
        name, sets = result
        assert name == "Squat"
        assert len(sets) == 1
        assert sets[0]["weight"] == 225.0
        assert sets[0]["reps"] == 5
        assert sets[0]["rir"] == 2

    def test_drop_set(self):
        """Set marked as drop."""
        result = parse_exercise_line("Lateral Raise 30x12 drop")
        assert result is not None
        name, sets = result
        assert sets[0]["set_type"] == "drop"

    def test_warmup_set(self):
        """Set marked as warmup."""
        result = parse_exercise_line("Bench Press 95x10 warmup")
        assert result is not None
        name, sets = result
        assert sets[0]["set_type"] == "warmup"

    def test_empty_line(self):
        """Empty line returns None."""
        assert parse_exercise_line("") is None
        assert parse_exercise_line("   ") is None

    def test_no_sets_returns_none(self):
        """Line without set data returns None."""
        assert parse_exercise_line("Just some random text") is None

    def test_decimal_weight(self):
        """Decimal weight values."""
        result = parse_exercise_line("Dumbbell Curl 27.5x10x3")
        assert result is not None
        name, sets = result
        assert name == "Dumbbell Curl"
        assert sets[0]["weight"] == 27.5

    def test_multi_word_exercise(self):
        """Multi-word exercise names."""
        result = parse_exercise_line("Incline Dumbbell Bench Press 80x8x3")
        assert result is not None
        name, _ = result
        assert name == "Incline Dumbbell Bench Press"
