"""Annuaire : fiches enrichies, filtres, tri, recherche en langage naturel, statistiques."""

import re
from dataclasses import dataclass, field
from statistics import median

from pydantic import BaseModel
from sqlmodel import Session, select

from . import domain as D
from .models import Favorite, Lawyer, Mandat, Note
from .privacy import vault


class LawyerView(BaseModel):
    id: int
    nom: str
    canton: str
    canton_nom: str
    ville: str
    ville_cle: str | None
    tarif: str
    tarif_min: int
    domaine: str
    domaines: list[str]
    specs: list[str]
    fsa: bool
    tel: str
    email: str
    lat: float | None
    lon: float | None
    favori: bool
    note: str
    mandats: int
    en_cours: int
    dernier_mandat: str | None
    evaluation: float | None
    distance: float | None = None
    ajoute: bool = False


@dataclass
class Context:
    """Données personnelles chargées une fois par requête."""

    favs: set[int]
    notes: dict[int, str]
    mandats: dict[int, list[Mandat]] = field(default_factory=dict)


def load_context(s: Session) -> Context:
    ctx = Context(
        favs={f.lawyer_id for f in s.exec(select(Favorite))},
        notes={n.lawyer_id: n.texte for n in s.exec(select(Note))},
    )
    for m in s.exec(select(Mandat)):
        ctx.mandats.setdefault(m.lawyer_id, []).append(m)
    return ctx


def display_name(a: Lawyer) -> str:
    names = vault.names()
    if names is not None and a.base_index is not None and a.base_index < len(names):
        return names[a.base_index]
    return a.nom


def view(a: Lawyer, ctx: Context) -> LawyerView:
    ms = sorted(ctx.mandats.get(a.id, []), key=lambda m: m.date, reverse=True)
    evals = [m.evaluation for m in ms if m.evaluation > 0]
    ll = D.city_ll(a.ville)
    return LawyerView(
        id=a.id,
        nom=display_name(a),
        canton=a.canton,
        canton_nom=D.CANTONS.get(a.canton, a.canton),
        ville=a.ville,
        ville_cle=D.primary_city(a.ville),
        tarif=a.tarif,
        tarif_min=D.tarif_min(a.tarif),
        domaine=a.domaine,
        domaines=D.domains(a.domaine),
        specs=D.specs_of(a.domaine),
        fsa=D.is_fsa(a.domaine),
        tel=a.tel,
        email=a.email,
        lat=ll[0] if ll else None,
        lon=ll[1] if ll else None,
        favori=a.id in ctx.favs,
        note=ctx.notes.get(a.id, ""),
        mandats=len(ms),
        en_cours=sum(m.statut != "clos" for m in ms),
        dernier_mandat=ms[0].date.isoformat() if ms else None,
        evaluation=round(sum(evals) / len(evals), 1) if evals else None,
        ajoute=a.base_index is None,
    )


def all_views(s: Session) -> list[LawyerView]:
    ctx = load_context(s)
    return [view(a, ctx) for a in s.exec(select(Lawyer).where(Lawyer.actif)).all()]


# ── Filtres ──


class Filters(BaseModel):
    q: str = ""
    cantons: list[str] = []
    specs: list[str] = []
    tarif_max: int | None = None
    fsa: bool = False
    favoris: bool = False
    pres_de: str = ""  # NPA ou ville
    rayon: int = 30
    tri: str = "pertinence"  # pertinence | tarif-asc | tarif-desc | ville | canton | rotation


def matches_query(v: LawyerView, q: str) -> bool:
    spec_hits = [spec for rx, spec in D.SYNONYMS if rx.search(q)]
    hay = D.strip(f"{v.nom} {v.ville} {v.domaine} {v.note}")
    return all(t in hay for t in q.split()) or any(s in v.specs for s in spec_hits)


def apply_filters(views: list[LawyerView], f: Filters) -> tuple[list[LawyerView], dict | None]:
    q = D.strip(f.q).strip()
    out = [
        v
        for v in views
        if (not q or matches_query(v, q))
        and (not f.cantons or v.canton in f.cantons)
        and (not f.specs or any(s in v.specs for s in f.specs))
        and (f.tarif_max is None or v.tarif_min <= f.tarif_max)
        and (not f.fsa or v.fsa)
        and (not f.favoris or v.favori)
    ]
    near = D.locate(f.pres_de) if f.pres_de else None
    if near:
        for v in out:
            v.distance = round(D.haversine(near["lat"], near["lon"], v.lat, v.lon), 1) if v.lat else None
        out = sorted(
            (v for v in out if v.distance is not None and v.distance <= f.rayon), key=lambda v: v.distance
        )
    keys = {
        "tarif-asc": lambda v: v.tarif_min,
        "tarif-desc": lambda v: -v.tarif_min,
        "ville": lambda v: D.strip(v.ville),
        "canton": lambda v: (v.canton, D.strip(v.ville)),
        # À qui le tour : jamais mandatés d'abord, puis le mandat le plus ancien, puis le moins cher.
        "rotation": lambda v: (v.dernier_mandat or "", v.tarif_min),
        "nom": lambda v: D.strip(v.nom),
    }
    if f.tri in keys:
        out.sort(key=keys[f.tri])
    return out, near


# ── Langage naturel (sans IA) : « travail Lausanne 20 km max 280 FSA » ──

STOP = {
    "un",
    "une",
    "le",
    "la",
    "les",
    "de",
    "du",
    "des",
    "a",
    "au",
    "aux",
    "en",
    "pour",
    "avec",
    "et",
    "ou",
    "pres",
    "proche",
    "autour",
    "vers",
    "sur",
    "dans",
    "avocat",
    "avocats",
    "avocate",
    "etude",
    "me",
    "cherche",
    "trouver",
    "besoin",
    "je",
    "il",
    "faut",
    "dossier",
    "affaire",
    "litige",
    "cas",
    "qui",
    "fait",
    "spec",
    "specialise",
    "specialiste",
    "certifie",
    "chf",
    "francs",
    "max",
    "maximum",
    "moins",
    "cher",
    "pas",
    "bon",
    "marche",
    "economique",
    "budget",
    "tarif",
    "km",
    "rayon",
    "fsa",
    "favoris",
    "favori",
    "mes",
}
CANTON_WORDS = {
    "vaudois": "VD",
    "genevois": "GE",
    "valaisan": "VS",
    "neuchatelois": "NE",
    "fribourgeois": "FR",
    "jurassien": "JU",
    "bernois": "BE",
    "bern": "BE",
    **{D.strip(n): c for c, n in D.CANTONS.items()},
    **{c.lower(): c for c in D.CANTONS},
}


class Parsed(BaseModel):
    filters: Filters
    resume: str


def parse_nl(raw: str) -> Parsed | None:
    q = D.strip(raw)
    if len(q) < 3:
        return None
    specs = [spec for rx, spec in D.SYNONYMS if rx.search(q)]
    specs = list(dict.fromkeys(specs))
    fsa = bool(re.search(r"\bfsa\b|specialis|certifi", q))
    fav = "favori" in q
    tarif = 250 if re.search(r"pas cher|bon marche|economique|petit budget|moins cher", q) else None
    m = (
        re.search(r"(?:max(?:imum)?|moins de|jusqu.?a|sous|<=?)\s*(?:chf\s*)?(\d{3})", q)
        or re.search(r"(\d{3})\s*(?:chf|\.?-|fr|francs)?\s*(?:max|maximum|au plus)", q)
        or re.search(r"(?:chf|budget)\s*(\d{3})", q)
    )
    if m:
        tarif = int(m.group(1))
    m = re.search(r"(\d{1,3})\s*km", q)
    rayon = min(100, max(5, int(m.group(1)))) if m else None
    m = re.search(r"\b(\d{4})\b", q)
    lieu = m.group(1) if m and m.group(1) in D.npa() else ""
    cantons, rest = [], []
    for t in filter(None, re.split(r"\s+", re.sub(r"[^a-z0-9\s'-]", " ", q))):
        if t.isdigit():
            continue
        if t in CANTON_WORDS:
            cantons.append(CANTON_WORDS[t])
            continue
        if not lieu and len(t) >= 4:
            k = next((k for k in D.cities() if k == t or (k.startswith(t) and len(t) >= 5)), None)
            if k and k not in CANTON_WORDS:
                lieu = D.cities()[k]["label"]
                continue
        if t in STOP or len(t) < 3 or any(rx.search(t) for rx, _ in D.SYNONYMS):
            continue
        rest.append(t)
    if not (specs or cantons or lieu or tarif or fsa or fav or rayon):
        return None
    f = Filters(
        q=" ".join(rest),
        cantons=list(dict.fromkeys(cantons)),
        specs=specs,
        tarif_max=tarif,
        fsa=fsa,
        favoris=fav,
        pres_de=lieu,
        rayon=rayon or 30,
    )
    return Parsed(filters=f, resume=describe(f))


def describe(f: Filters) -> str:
    p = []
    if f.specs:
        p.append(" + ".join(s.split(" /")[0] for s in f.specs))
    if f.pres_de:
        p.append(f"autour de {f.pres_de} ({f.rayon} km)")
    if f.cantons:
        p.append(", ".join(D.CANTONS.get(c, c) for c in f.cantons))
    if f.tarif_max:
        p.append(f"≤ CHF {f.tarif_max}.–")
    if f.fsa:
        p.append("FSA")
    if f.favoris:
        p.append("favoris")
    if f.q:
        p.append(f"« {f.q} »")
    return " · ".join(p)


# ── Statistiques ──


def stats(views: list[LawyerView]) -> dict:
    by_canton = {}
    for c, nom in D.CANTONS.items():
        lst = [v for v in views if v.canton == c]
        if not lst:
            continue
        t = [v.tarif_min for v in lst]
        by_canton[c] = {
            "nom": nom,
            "n": len(lst),
            "fsa": sum(v.fsa for v in lst),
            "villes": len({v.ville_cle or D.strip(v.ville) for v in lst}),
            "tarif_min": min(t),
            "tarif_max": max(t),
            "tarif_median": round(median(t)),
        }
    villes: dict[str, int] = {}
    for v in views:
        if v.ville_cle:
            villes[v.ville_cle] = villes.get(v.ville_cle, 0) + 1
    return {
        "avocats": len(views),
        "cantons": len(by_canton),
        "villes": len({v.ville_cle or D.strip(v.ville) for v in views}),
        "fsa": sum(v.fsa for v in views),
        "tarif_moyen": round(sum(D.tarif_mid(v.tarif) for v in views) / len(views)) if views else 0,
        "tarif_bornes": [
            min((v.tarif_min for v in views), default=0),
            max((v.tarif_min for v in views), default=0),
        ],
        "par_canton": by_canton,
        "par_specialite": {s: sum(s in v.specs for v in views) for s in D.SPECS},
        "par_ville": [
            {"cle": k, "nom": D.cities()[k]["label"], "n": n}
            for k, n in sorted(villes.items(), key=lambda kv: -kv[1])
        ],
    }
