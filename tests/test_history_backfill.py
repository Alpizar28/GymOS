from src.services.history_backfill import _classify_training_type, _normalize_template_name


def test_normalize_template_name_handles_symbols_and_spaces():
    assert _normalize_template_name(" Push__Heavy!! ") == "push heavy"


def test_classify_training_type_supports_push_pull_legs_and_custom():
    assert _classify_training_type("Push A") == "push"
    assert _classify_training_type("Pull Day") == "pull"
    assert _classify_training_type("Posterior Heavy") == "legs"
    assert _classify_training_type("Push Pull Mix") == "custom"
    assert _classify_training_type(None) == "custom"
