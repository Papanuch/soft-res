"""Règles métier : spécialités, tarifs, géographie (repris de l'ancienne application)."""

import json
import math
import re
import unicodedata
from functools import lru_cache

from .config import PACKAGE

CANTONS = {
    "VD": "Vaud",
    "GE": "Genève",
    "NE": "Neuchâtel",
    "VS": "Valais",
    "JU": "Jura",
    "FR": "Fribourg",
    "BE": "Berne",
}

# Spécialité → motif reconnu dans le champ « domaine ».
SPECS: dict[str, re.Pattern] = {
    "Droit du travail": re.compile(r"travail", re.IGNORECASE),
    "Assurances & RC": re.compile(r"assurance|(^|\W)rc(\W|$)", re.IGNORECASE),
    "Construction / Immobilier": re.compile(r"construction|immobilier", re.IGNORECASE),
    "Bail": re.compile(r"bail", re.IGNORECASE),
    "Pénal / LCR": re.compile(r"p[ée]nal|lcr", re.IGNORECASE),
    "Contrats": re.compile(r"contrat", re.IGNORECASE),
    "Généraliste": re.compile(r"g[ée]n[ée]ralis", re.IGNORECASE),
}

# Vocabulaire courant (texte normalisé, sans accents) → spécialité.
SYNONYMS: list[tuple[re.Pattern, str]] = [
    (re.compile(rx), spec)
    for rx, spec in [
        (
            r"licenci|salari|employe|employeur|\btravail|prud|harcel|conge|certificat de travail|heures sup|salaire",
            "Droit du travail",
        ),
        (
            r"assuranc|\brc\b|responsabilit|sinistre|accident|lamal|\blaa\b|\blpp\b|indemnit|dommage",
            "Assurances & RC",
        ),
        (
            (
                r"construct|immobili|chantier|entreprise general|architect|defaut|malfacon|\bppe\b|servitude|voisin|hypoth"
                r"|maitre d.ouvrage"
            ),
            "Construction / Immobilier",
        ),
        (r"\bbail|loyer|locat|bailleur|asloca|etat des lieux|sous.loc", "Bail"),
        (
            r"penal|\blcr\b|permis|circulation|vitesse|alcool|plainte|ordonnance|retrait|radar|amende",
            "Pénal / LCR",
        ),
        (
            r"contrat|vente|mandat|achat|garantie|facture|recouvrement|poursuite|dette|creance|commandement",
            "Contrats",
        ),
        (r"generalis", "Généraliste"),
    ]
]


def strip(s: str | None) -> str:
    """Minuscules sans accents, pour comparer des textes."""
    s = unicodedata.normalize("NFD", str(s or ""))
    return "".join(c for c in s if unicodedata.category(c) != "Mn").lower()


def guess_spec(text: str) -> str | None:
    t = strip(text)
    return next((spec for rx, spec in SYNONYMS if rx.search(t)), None)


def specs_of(domaine: str) -> list[str]:
    return [name for name, rx in SPECS.items() if rx.search(domaine)]


def is_fsa(domaine: str) -> bool:
    return "fsa" in domaine.lower()


def tarif_min(tarif: str) -> int:
    """« 250-300 » → 250 (borne basse)."""
    m = re.match(r"\d+", str(tarif))
    return int(m.group()) if m else 0


def tarif_mid(tarif: str) -> float:
    n = [int(x) for x in re.findall(r"\d+", str(tarif))]
    return sum(n) / len(n) if n else 0


def chf_tarif(tarif: str) -> str:
    lo, _, hi = str(tarif).partition("-")
    return f"CHF {lo}.— à CHF {hi}.—" if hi else f"CHF {lo}.—"


def domains(domaine: str) -> list[str]:
    return [d.strip() for d in re.split(r"[/,]", domaine) if d.strip()]


def first_city(ville: str) -> str:
    return re.split(r"\s*/\s*|\s+et\s+", ville)[0]


# ── Géographie ──


@lru_cache
def carte() -> dict:
    return json.loads((PACKAGE / "seed" / "carte.json").read_text(encoding="utf-8"))


@lru_cache
def npa() -> dict[str, list]:
    """NPA → [lat, lon, localité]."""
    return json.loads((PACKAGE / "seed" / "npa.json").read_text(encoding="utf-8"))


def unproject(x: float, y: float) -> tuple[float, float]:
    p = carte()["proj"]
    lat = (2 * math.atan(math.exp(p["py1"] - y / p["sc"])) - math.pi / 2) * 180 / math.pi
    lon = (x / p["sc"] + p["px0"]) * 180 / math.pi
    return lat, lon


def project(lat: float, lon: float) -> tuple[float, float]:
    p = carte()["proj"]
    x = (lon * math.pi / 180 - p["px0"]) * p["sc"]
    y = (p["py1"] - math.log(math.tan(math.pi / 4 + lat * math.pi / 360))) * p["sc"]
    return x, y


def haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    r = math.pi / 180
    d_la, d_lo = (lat2 - lat1) * r, (lon2 - lon1) * r
    x = math.sin(d_la / 2) ** 2 + math.cos(lat1 * r) * math.cos(lat2 * r) * math.sin(d_lo / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(x))


@lru_cache
def cities() -> dict[str, dict]:
    """Villes du fond de carte : clé normalisée → {label, lat, lon, x, y}."""
    out = {}
    for name, (x, y) in carte()["cities"].items():
        lat, lon = unproject(x, y)
        out[strip(name)] = {"label": name, "lat": lat, "lon": lon, "x": x, "y": y}
    return out


def primary_city(ville: str) -> str | None:
    """Ville principale d'un libellé composite (« Genève / Lutry », « Bulle et Châtel-st-Denis »)."""
    keys = list(cities())
    for t in filter(None, re.split(r"\s*/\s*|\s+et\s+|\s*,\s*", strip(ville))):
        k = next((k for k in keys if k == t or k.startswith(t) or t.startswith(k)), None)
        if k:
            return k
    return None


def city_ll(ville: str) -> tuple[float, float] | None:
    k = primary_city(ville)
    if not k:
        return None
    c = cities()[k]
    return c["lat"], c["lon"]


def locate(place: str) -> dict | None:
    """NPA (« 1003 ») ou nom de ville → {label, lat, lon}."""
    place = place.strip()
    if re.fullmatch(r"\d{4}", place) and place in npa():
        lat, lon, label = npa()[place]
        return {"label": f"{place} {label}", "lat": lat, "lon": lon}
    k = primary_city(place)
    if k:
        c = cities()[k]
        return {"label": c["label"], "lat": c["lat"], "lon": c["lon"]}
    t = strip(place)
    for code, (lat, lon, label) in npa().items():
        if strip(label) == t:
            return {"label": f"{code} {label}", "lat": lat, "lon": lon}
    return None
