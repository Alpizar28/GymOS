"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Type-safe settings from .env file."""

    telegram_bot_token: str = ""
    anthropic_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///data/gym.db"
    log_level: str = "INFO"

    # LLM config
    llm_model: str = "claude-sonnet-4-20250514"
    llm_max_tokens: int = 4096

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
