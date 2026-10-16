"""Connexion SQLite, création des tables et chargement initial de l'annuaire."""

import json
from collections.abc import Iterator

from sqlalchemy import event
from sqlmodel import Session, SQLModel, create_engine, select

from .config import PACKAGE, settings
from .models import Lawyer

SEED = PACKAGE / "seed"
_engine = None


def engine():
    global _engine
    if _engine is None:
        _engine = create_engine(settings().db_url, connect_args={"check_same_thread": False})

        @event.listens_for(_engine, "connect")
        def _pragmas(conn, _):
            cur = conn.cursor()
            cur.execute("PRAGMA foreign_keys=ON")
            cur.execute("PRAGMA journal_mode=WAL")
            cur.close()

    return _engine


def reset_engine(url: str | None = None) -> None:
    """Pour les tests : repart sur une base neuve."""
    global _engine
    if _engine is not None:
        _engine.dispose()
    _engine = create_engine(url, connect_args={"check_same_thread": False}) if url else None


def init_db() -> None:
    SQLModel.metadata.create_all(engine())
    with Session(engine()) as s:
        if s.exec(select(Lawyer).limit(1)).first() is None:
            seed_lawyers(s)


def seed_lawyers(s: Session) -> None:
    """Annuaire d'origine : les identifiants sont conservés pour rester compatibles
    avec les sauvegardes de l'ancienne application (favoris, notes, mandats)."""
    for i, a in enumerate(json.loads((SEED / "avocats.json").read_text(encoding="utf-8"))):
        s.add(
            Lawyer(
                id=a["id"],
                canton=a["canton"],
                nom=a["avocat"],
                ville=a["ville"],
                tarif=a["tarif"],
                domaine=a["domaine"],
                tel=a["tel"],
                base_index=i,
            )
        )
    s.commit()


def get_session() -> Iterator[Session]:
    with Session(engine()) as s:
        yield s
