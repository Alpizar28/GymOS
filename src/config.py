"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Type-safe settings from .env file."""

    telegram_bot_token: str = ""
    openai_api_key: str = ""
    database_url: str = "sqlite+aiosqlite:///data/gym.db"
    log_level: str = "INFO"
    web_url: str = "http://localhost:8000"

    # LLM config
    llm_model: str = "gpt-4o"
    llm_max_tokens: int = 4096

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
