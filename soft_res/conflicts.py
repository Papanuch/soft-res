"""Contrôle de conflit d'intérêts sur l'historique des mandats.

Comparaison approximative (rapidfuzz) après normalisation : « Régie Dupont SA », « Dupont Régie »
et « REGIE DUPONT S.A. » sont reconnus comme la même partie, fautes de frappe légères comprises.
"""

import re

from pydantic import BaseModel
from rapidfuzz import fuzz
from sqlmodel import Session, select

from .domain import strip
from .models import Mandat

LEGAL_FORMS = r"\b(sa|s a|sarl|s a r l|ag|gmbh|sas|snc|scs|sci|ltd|inc|cie|co|et associes|associes|holding)\b"
TITLES = r"\b(m|mme|mlle|me|maitre|dr|monsieur|madame)\b"
THRESHOLD = 86


def normalize(name: str) -> str:
    s = re.sub(r"[^a-z0-9\s]", " ", strip(name))
    s = re.sub(LEGAL_FORMS, " ", s)
    s = re.sub(TITLES, " ", s)
    return re.sub(r"\s+", " ", s).strip()


def similarity(a: str, b: str) -> int:
    na, nb = normalize(a), normalize(b)
    if len(na) < 3 or len(nb) < 3:
        return 0
    if na == nb:
        return 100
    # token_set : insensible à l'ordre et aux mots en plus (« Régie Dupont » ⊂ « Régie Dupont Lausanne »).
    score = max(fuzz.token_set_ratio(na, nb), fuzz.ratio(na, nb))
    # Un seul mot commun (« Dupont ») ne suffit pas s'il est court ou si l'autre nom est bien plus long.
    if score == 100 and min(len(na.split()), len(nb.split())) == 1 and abs(len(na) - len(nb)) > 12:
        score = 88
    return int(score)


class Hit(BaseModel):
    mandat_id: int
    lawyer_id: int
    ref: str
    date: str
    assure: str
    adverse: str
    role: str  # « assuré·e » ou « partie adverse » : rôle de la personne cherchée dans ce mandat
    score: int


def search(s: Session, name: str, lawyer_id: int | None = None) -> list[Hit]:
    if len(normalize(name)) < 3:
        return []
    q = select(Mandat)
    if lawyer_id is not None:
        q = q.where(Mandat.lawyer_id == lawyer_id)
    hits = []
    for m in s.exec(q):
        for role, other in (("assuré·e", m.assure), ("partie adverse", m.adverse)):
            sc = similarity(name, other)
            if sc >= THRESHOLD:
                hits.append(
                    Hit(
                        mandat_id=m.id,
                        lawyer_id=m.lawyer_id,
                        ref=m.ref,
                        date=m.date.isoformat(),
                        assure=m.assure,
                        adverse=m.adverse,
                        role=role,
                        score=sc,
                    )
                )
    return sorted(hits, key=lambda h: (-h.score, h.date))


class Conflict(BaseModel):
    hit: Hit
    raison: str


def conflicts_for(s: Session, lawyer_id: int, assure: str, adverse: str) -> list[Conflict]:
    """Conflit réel : l'assuré·e a été partie adverse d'un dossier confié à cet avocat,
    ou la partie adverse a été défendue par lui."""
    out = []
    if assure:
        for h in search(s, assure, lawyer_id):
            if h.role == "partie adverse":
                out.append(
                    Conflict(
                        hit=h,
                        raison=f"{assure} était partie adverse dans le dossier "
                        f"{h.ref or '?'} confié à cet avocat",
                    )
                )
    if adverse:
        for h in search(s, adverse, lawyer_id):
            if h.role == "assuré·e":
                out.append(
                    Conflict(
                        hit=h,
                        raison=f"{adverse} était l'assuré·e défendu·e par cet avocat "
                        f"(dossier {h.ref or '?'})",
                    )
                )
    return out
