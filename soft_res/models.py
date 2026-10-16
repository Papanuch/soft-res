"""Tables SQLite (SQLModel)."""

import datetime as dt
from datetime import UTC, datetime

from sqlmodel import Field, SQLModel


def now() -> datetime:
    return datetime.now(UTC)


class Lawyer(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    canton: str = Field(index=True)
    nom: str  # nom affiché par défaut (anonymisé pour l'annuaire d'origine)
    ville: str
    tarif: str  # « 250 » ou « 250-300 » (CHF/h)
    domaine: str  # texte libre : « FSA Travail / Bail »
    tel: str = ""
    email: str = ""
    # Position dans le bloc chiffré des noms réels (None pour un avocat ajouté à la main).
    base_index: int | None = None
    actif: bool = True
    cree_le: datetime = Field(default_factory=now)


class Favorite(SQLModel, table=True):
    lawyer_id: int = Field(primary_key=True, foreign_key="lawyer.id")


class Note(SQLModel, table=True):
    lawyer_id: int = Field(primary_key=True, foreign_key="lawyer.id")
    texte: str
    maj_le: datetime = Field(default_factory=now)


class Recent(SQLModel, table=True):
    lawyer_id: int = Field(primary_key=True, foreign_key="lawyer.id")
    vu_le: datetime = Field(default_factory=now, index=True)


class Mandat(SQLModel, table=True):
    id: int | None = Field(default=None, primary_key=True)
    lawyer_id: int = Field(foreign_key="lawyer.id", index=True)
    ref: str = ""
    date: dt.date = Field(default_factory=dt.date.today)
    assure: str = ""
    adverse: str = ""
    matiere: str = ""
    note: str = ""
    statut: str = "en cours"  # « en cours » | « clos »
    evaluation: int = 0  # 0 = non évalué, sinon 1 à 5


class Setting(SQLModel, table=True):
    key: str = Field(primary_key=True)
    value: str
