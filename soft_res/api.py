"""Routes HTTP (préfixe /api), consommées par l'interface React."""

import csv
import datetime as dt
import io
import json
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
from sqlmodel import Session, select

from . import __version__, ai, assistant, backup, conflicts, courrier
from . import domain as D
from .config import settings
from .db import get_session
from .models import Favorite, Lawyer, Mandat, Note, Recent, Setting, now
from .privacy import WrongPassphrase, vault
from .search import (
    Filters,
    LawyerView,
    all_views,
    apply_filters,
    display_name,
    load_context,
    parse_nl,
    stats,
    view,
)

router = APIRouter(prefix="/api")
Db = Annotated[Session, Depends(get_session)]


def lawyer_or_404(s: Session, lawyer_id: int) -> Lawyer:
    a = s.get(Lawyer, lawyer_id)
    if a is None or not a.actif:
        raise HTTPException(404, "Avocat introuvable")
    return a


# ── État général ──


@router.get("/etat")
def etat():
    st = settings()
    return {
        "version": __version__,
        "ia": st.ai_enabled,
        "modele": st.softres_model,
        "noms_reels": {"disponible": vault.available, "deverrouille": vault.names() is not None},
        "dossier_donnees": str(st.data_dir),
        "verrouillage_minutes": st.softres_lock_minutes,
    }


@router.get("/stats")
def get_stats(s: Db):
    return stats(all_views(s))


@router.get("/carte")
def get_carte(s: Db):
    m = D.carte()
    counts: dict[str, int] = {}
    for v in all_views(s):
        if v.ville_cle:
            counts[v.ville_cle] = counts.get(v.ville_cle, 0) + 1
    villes = [
        {"cle": k, "nom": c["label"], "x": c["x"], "y": c["y"], "n": counts.get(k, 0)}
        for k, c in D.cities().items()
    ]
    return {
        "w": m["w"],
        "h": m["h"],
        "cantons": m["cantons"],
        "lacs": m["lakes"],
        "villes": villes,
        "noms_cantons": D.CANTONS,
    }


@router.get("/lieux")
def lieux(q: str = ""):
    """Autocomplétion NPA / localité."""
    t = D.strip(q).strip()
    if len(t) < 2:
        return []
    out = []
    for k, c in D.cities().items():
        if k.startswith(t):
            out.append({"valeur": c["label"], "libelle": c["label"]})
    for code, (_, _, label) in D.npa().items():
        if code.startswith(t) or D.strip(label).startswith(t):
            out.append({"valeur": code, "libelle": f"{code} {label}"})
        if len(out) >= 12:
            break
    return out[:12]


# ── Annuaire ──


class SearchResult(BaseModel):
    avocats: list[LawyerView]
    total: int
    pres_de: dict | None


@router.post("/annuaire", response_model=SearchResult)
def annuaire(f: Filters, s: Db):
    views = all_views(s)
    out, near = apply_filters(views, f)
    return SearchResult(avocats=out, total=len(views), pres_de=near)


class Texte(BaseModel):
    texte: str


@router.post("/annuaire/interpreter")
def interpreter(body: Texte):
    return parse_nl(body.texte)


class LawyerIn(BaseModel):
    nom: str
    canton: str
    ville: str
    tarif: str
    domaine: str
    tel: str = ""
    email: str = ""


class LawyerPatch(BaseModel):
    nom: str | None = None
    canton: str | None = None
    ville: str | None = None
    tarif: str | None = None
    domaine: str | None = None
    tel: str | None = None
    email: str | None = None


class MandatView(BaseModel):
    id: int
    lawyer_id: int
    avocat: str
    ref: str
    date: dt.date
    assure: str
    adverse: str
    matiere: str
    note: str
    statut: str
    evaluation: int


def mandat_view(m: Mandat, s: Session) -> MandatView:
    a = s.get(Lawyer, m.lawyer_id)
    return MandatView(**m.model_dump(), avocat=display_name(a) if a else "(avocat retiré)")


@router.get("/avocats/{lawyer_id}")
def get_lawyer(lawyer_id: int, s: Db):
    a = lawyer_or_404(s, lawyer_id)
    ms = s.exec(select(Mandat).where(Mandat.lawyer_id == lawyer_id).order_by(Mandat.date.desc())).all()
    return {"avocat": view(a, load_context(s)), "mandats": [mandat_view(m, s) for m in ms]}


@router.post("/avocats", response_model=LawyerView)
def create_lawyer(body: LawyerIn, s: Db):
    if D.tarif_min(body.tarif) == 0:
        raise HTTPException(422, "Tarif invalide : indiquer un nombre, par exemple 250 ou 250-300")
    a = Lawyer(**body.model_dump())
    s.add(a)
    s.commit()
    s.refresh(a)
    return view(a, load_context(s))


@router.patch("/avocats/{lawyer_id}", response_model=LawyerView)
def update_lawyer(lawyer_id: int, body: LawyerPatch, s: Db):
    a = lawyer_or_404(s, lawyer_id)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(a, k, v)
    s.commit()
    s.refresh(a)
    return view(a, load_context(s))


@router.delete("/avocats/{lawyer_id}", status_code=204)
def delete_lawyer(lawyer_id: int, s: Db):
    a = lawyer_or_404(s, lawyer_id)
    a.actif = False  # retrait réversible : l'historique des mandats reste lisible
    s.commit()


class Toggle(BaseModel):
    on: bool


@router.put("/avocats/{lawyer_id}/favori")
def set_favori(lawyer_id: int, body: Toggle, s: Db):
    lawyer_or_404(s, lawyer_id)
    f = s.get(Favorite, lawyer_id)
    if body.on and not f:
        s.add(Favorite(lawyer_id=lawyer_id))
    elif not body.on and f:
        s.delete(f)
    s.commit()
    return {"on": body.on}


@router.put("/avocats/{lawyer_id}/note")
def set_note(lawyer_id: int, body: Texte, s: Db):
    lawyer_or_404(s, lawyer_id)
    n = s.get(Note, lawyer_id)
    txt = body.texte.strip()
    if txt:
        if n:
            n.texte, n.maj_le = txt, now()
        else:
            s.add(Note(lawyer_id=lawyer_id, texte=txt))
    elif n:
        s.delete(n)
    s.commit()
    return {"texte": txt}


@router.post("/avocats/{lawyer_id}/vu", status_code=204)
def mark_seen(lawyer_id: int, s: Db):
    lawyer_or_404(s, lawyer_id)
    s.merge(Recent(lawyer_id=lawyer_id, vu_le=now()))
    s.commit()


@router.get("/recents", response_model=list[LawyerView])
def recents(s: Db):
    ctx = load_context(s)
    out = []
    for r in s.exec(select(Recent).order_by(Recent.vu_le.desc()).limit(8)):
        a = s.get(Lawyer, r.lawyer_id)
        if a and a.actif:
            out.append(view(a, ctx))
    return out


# ── Mandats ──


class MandatIn(BaseModel):
    lawyer_id: int
    ref: str = ""
    date: dt.date | None = None
    assure: str = ""
    adverse: str = ""
    matiere: str = ""
    note: str = ""
    statut: str = "en cours"
    evaluation: int = 0


class MandatPatch(BaseModel):
    ref: str | None = None
    date: dt.date | None = None
    assure: str | None = None
    adverse: str | None = None
    matiere: str | None = None
    note: str | None = None
    statut: str | None = None
    evaluation: int | None = None


@router.get("/mandats", response_model=list[MandatView])
def list_mandats(s: Db, lawyer_id: int | None = None):
    q = select(Mandat).order_by(Mandat.date.desc(), Mandat.id.desc())
    if lawyer_id is not None:
        q = q.where(Mandat.lawyer_id == lawyer_id)
    return [mandat_view(m, s) for m in s.exec(q)]


@router.post("/mandats", response_model=MandatView)
def create_mandat(body: MandatIn, s: Db):
    lawyer_or_404(s, body.lawyer_id)
    data = body.model_dump()
    data["date"] = data["date"] or date.today()
    data["matiere"] = data["matiere"] or D.guess_spec(f"{body.note} {body.matiere}") or "Généraliste"
    m = Mandat(**data)
    s.add(m)
    s.commit()
    s.refresh(m)
    return mandat_view(m, s)


@router.patch("/mandats/{mandat_id}", response_model=MandatView)
def update_mandat(mandat_id: int, body: MandatPatch, s: Db):
    m = s.get(Mandat, mandat_id)
    if not m:
        raise HTTPException(404, "Mandat introuvable")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(m, k, v)
    if not 0 <= m.evaluation <= 5:
        raise HTTPException(422, "Évaluation entre 0 et 5")
    s.commit()
    s.refresh(m)
    return mandat_view(m, s)


@router.delete("/mandats/{mandat_id}", status_code=204)
def delete_mandat(mandat_id: int, s: Db):
    m = s.get(Mandat, mandat_id)
    if not m:
        raise HTTPException(404, "Mandat introuvable")
    s.delete(m)
    s.commit()


# ── Conflits ──


@router.get("/conflits")
def search_conflicts(nom: str, s: Db):
    hits = conflicts.search(s, nom)
    names = {a.id: display_name(a) for a in s.exec(select(Lawyer))}
    return [{**h.model_dump(), "avocat": names.get(h.lawyer_id, "?")} for h in hits]


class ConflictCheck(BaseModel):
    lawyer_id: int
    assure: str = ""
    adverse: str = ""


@router.post("/conflits/avocat")
def check_conflicts(body: ConflictCheck, s: Db):
    return [c.raison for c in conflicts.conflicts_for(s, body.lawyer_id, body.assure, body.adverse)]


# ── Assistant ──


@router.post("/assistant/regles", response_model=assistant.Result)
def assistant_rules(c: assistant.Criteria, s: Db):
    return assistant.by_rules(s, c)


class Demande(BaseModel):
    demande: str


@router.post("/assistant/ia", response_model=assistant.Result)
def assistant_ai(body: Demande, s: Db):
    if len(body.demande.strip()) < 5:
        raise HTTPException(422, "Décrivez le dossier en une phrase au moins")
    return assistant.by_ai(s, body.demande)


# ── Courrier ──


class CourrierIn(BaseModel):
    lawyer_id: int
    dossier: courrier.Dossier
    ia: bool = False


@router.post("/courrier")
def make_courrier(body: CourrierIn, s: Db):
    a = lawyer_or_404(s, body.lawyer_id)
    nom = display_name(a)
    warn = ""
    texte = courrier.template(a, nom, body.dossier)
    moteur = "modele"
    if body.ia:
        try:
            texte = courrier.with_ai(a, nom, body.dossier)
            moteur = "ia"
        except ai.AIUnavailable as e:
            warn = f"Rédaction IA indisponible ({e}) : modèle standard utilisé."
    found = conflicts.conflicts_for(s, a.id, body.dossier.assure, body.dossier.adverse)
    return {"texte": texte, "moteur": moteur, "avertissement": warn, "conflits": [c.raison for c in found]}


# ── Réglages ──


@router.get("/reglages")
def get_settings(s: Db):
    return {x.key: x.value for x in s.exec(select(Setting))}


@router.put("/reglages/{key}")
def put_setting(key: str, body: Texte, s: Db):
    if key not in {"signature", "theme"}:
        raise HTTPException(404, "Réglage inconnu")
    s.merge(Setting(key=key, value=body.texte))
    s.commit()
    return {key: body.texte}


# ── Noms réels ──


class Phrase(BaseModel):
    phrase: str


@router.post("/noms/deverrouiller")
def unlock(body: Phrase):
    if not vault.available:
        raise HTTPException(404, "Aucun bloc de noms chiffrés")
    try:
        n = vault.unlock(body.phrase)
    except WrongPassphrase:
        raise HTTPException(403, "Phrase de passe incorrecte") from None
    return {"noms": n}


@router.post("/noms/verrouiller", status_code=204)
def lock():
    vault.lock()


# ── Sauvegarde ──


@router.get("/sauvegarde")
def get_backup(s: Db):
    name = f"soft-res_sauvegarde_{date.today():%Y%m%d}.json"
    return Response(
        content=json.dumps(backup.export(s), ensure_ascii=False, indent=1),
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


class Restore(BaseModel):
    data: dict
    remplacer: bool = False


@router.post("/sauvegarde")
def restore(body: Restore, s: Db):
    try:
        return backup.import_data(s, body.data, body.remplacer)
    except (ValueError, KeyError) as e:
        s.rollback()
        raise HTTPException(422, str(e)) from None


@router.get("/export.csv")
def export_csv(s: Db):
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    w.writerow(
        [
            "Avocat",
            "Canton",
            "Ville",
            "Tarif CHF/h",
            "Domaines",
            "Téléphone",
            "Email",
            "FSA",
            "Favori",
            "Mandats",
            "Évaluation",
            "Note",
        ]
    )
    for v in sorted(all_views(s), key=lambda v: (v.canton, D.strip(v.ville))):
        w.writerow(
            [
                v.nom,
                v.canton,
                v.ville,
                v.tarif,
                v.domaine,
                v.tel,
                v.email,
                "oui" if v.fsa else "",
                "oui" if v.favori else "",
                v.mandats,
                v.evaluation or "",
                v.note,
            ]
        )
    return Response(
        content="﻿" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="soft-res_annuaire.csv"'},
    )
