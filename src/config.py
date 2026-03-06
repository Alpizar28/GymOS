"""Application configuration loaded from environment variables."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Type-safe settings from .env file."""

    openai_api_key: str = ""
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/postgres"
    database_statement_cache_size: int = 0
    log_level: str = "INFO"
    web_url: str = "http://localhost:3000"
    port: int = 8000

    # Auth (Supabase)
    auth_enabled: bool = False
    supabase_url: str = ""
    supabase_jwt_audience: str = "authenticated"
    dev_fallback_user_id: str = "00000000-0000-0000-0000-000000000001"

    # LLM config
    llm_model: str = "gpt-4o"
    llm_max_tokens: int = 4096

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
