"""Réglages lus depuis l'environnement et le fichier .env (à la racine du projet)."""

from functools import lru_cache
from pathlib import Path

from platformdirs import user_data_dir
from pydantic_settings import BaseSettings, SettingsConfigDict

ROOT = Path(__file__).resolve().parent.parent
PACKAGE = Path(__file__).resolve().parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", env_file_encoding="utf-8", extra="ignore")

    anthropic_api_key: str = ""
    softres_model: str = "claude-opus-5-5"
    softres_data_dir: Path | None = None
    # Verrouillage automatique des noms réels après N minutes sans activité.
    softres_lock_minutes: int = 20

    @property
    def data_dir(self) -> Path:
        d = self.softres_data_dir or Path(user_data_dir("SoftRes", appauthor=False))
        d.mkdir(parents=True, exist_ok=True)
        return d

    @property
    def db_url(self) -> str:
        return f"sqlite:///{self.data_dir / 'soft-res.db'}"

    @property
    def ai_enabled(self) -> bool:
        return self.anthropic_api_key.startswith("sk-ant-")


@lru_cache
def settings() -> Settings:
    return Settings()
