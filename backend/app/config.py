from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://rota_user:rota_pass@localhost:5432/rota"
    HOLIDAY_API_URL: str = "https://date.nager.at/api/v3"
    CITY: str = "Madrid"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()
