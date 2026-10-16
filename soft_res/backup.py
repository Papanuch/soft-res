"""Sauvegarde / restauration en JSON, et reprise des exports de l'ancienne application Orion."""

from datetime import date, datetime

from sqlmodel import Session, delete, select

from .models import Favorite, Lawyer, Mandat, Note, Recent, Setting

FORMAT = "soft-res"


def export(s: Session) -> dict:
    return {
        "format": FORMAT,
        "version": 1,
        "exporte_le": datetime.now().isoformat(timespec="seconds"),
        "avocats": [a.model_dump(mode="json") for a in s.exec(select(Lawyer))],
        "favoris": [f.lawyer_id for f in s.exec(select(Favorite))],
        "notes": [n.model_dump(mode="json") for n in s.exec(select(Note))],
        "mandats": [m.model_dump(mode="json") for m in s.exec(select(Mandat))],
        "reglages": {x.key: x.value for x in s.exec(select(Setting))},
    }


def _wipe_personal(s: Session) -> None:
    for t in (Mandat, Note, Favorite, Recent):
        s.exec(delete(t))


def import_data(s: Session, data: dict, replace: bool = False) -> dict:
    if data.get("format") == FORMAT:
        return _import_native(s, data, replace)
    if data.get("orion") == "local-data":
        return _import_orion(s, data, replace)
    raise ValueError(
        "Fichier non reconnu : attendu une sauvegarde Soft - Res ou un export de l'ancienne app Orion"
    )


def _import_native(s: Session, data: dict, replace: bool) -> dict:
    if replace:
        _wipe_personal(s)
        s.exec(delete(Lawyer))
        s.flush()
    known = {a.id for a in s.exec(select(Lawyer))}
    n_av = 0
    for a in data.get("avocats", []):
        if a["id"] not in known:
            s.add(Lawyer.model_validate(a))
            n_av += 1
    s.flush()
    ids = {a.id for a in s.exec(select(Lawyer))}
    favs = {f.lawyer_id for f in s.exec(select(Favorite))}
    for fid in data.get("favoris", []):
        if fid in ids and fid not in favs:
            s.add(Favorite(lawyer_id=fid))
    notes = {n.lawyer_id for n in s.exec(select(Note))}
    for n in data.get("notes", []):
        if n["lawyer_id"] in ids and n["lawyer_id"] not in notes:
            s.add(Note.model_validate(n))
    existing = {(m.lawyer_id, m.ref, m.date.isoformat(), m.assure) for m in s.exec(select(Mandat))}
    n_m = 0
    for m in data.get("mandats", []):
        key = (m["lawyer_id"], m.get("ref", ""), m.get("date", ""), m.get("assure", ""))
        if m["lawyer_id"] in ids and key not in existing:
            m = {k: v for k, v in m.items() if k != "id"}
            s.add(Mandat.model_validate(m))
            n_m += 1
    for k, v in data.get("reglages", {}).items():
        s.merge(Setting(key=k, value=v))
    s.commit()
    return {"avocats": n_av, "mandats": n_m}


def _import_orion(s: Session, data: dict, replace: bool) -> dict:
    """Format de l'ancienne app : favs, notes {id: texte}, mandats, overrides {edits, added, removed}."""
    if replace:
        _wipe_personal(s)
    ovr = data.get("overrides") or {}
    n_av = 0
    for x in ovr.get("added", []):
        if s.get(Lawyer, x["id"]) is None:
            s.add(
                Lawyer(
                    id=x["id"],
                    canton=x.get("canton", "VD"),
                    nom=x.get("avocat", "?"),
                    ville=x.get("ville", ""),
                    tarif=str(x.get("tarif", "0")),
                    domaine=x.get("domaine", ""),
                    tel=x.get("tel", ""),
                )
            )
            n_av += 1
    for sid, patch in (ovr.get("edits") or {}).items():
        a = s.get(Lawyer, int(sid))
        if a:
            for src, dst in (
                ("canton", "canton"),
                ("ville", "ville"),
                ("tarif", "tarif"),
                ("domaine", "domaine"),
                ("tel", "tel"),
            ):
                if src in patch:
                    setattr(a, dst, str(patch[src]))
    for rid in ovr.get("removed", []):
        a = s.get(Lawyer, int(rid))
        if a:
            a.actif = False
    s.flush()
    ids = {a.id for a in s.exec(select(Lawyer))}
    favs = {f.lawyer_id for f in s.exec(select(Favorite))}
    for fid in data.get("favs", []):
        if fid in ids and fid not in favs:
            s.add(Favorite(lawyer_id=fid))
    for sid, txt in (data.get("notes") or {}).items():
        lid = int(sid)
        if lid in ids and s.get(Note, lid) is None and txt:
            s.add(Note(lawyer_id=lid, texte=txt))
    existing = {(m.lawyer_id, m.ref, m.date.isoformat(), m.assure) for m in s.exec(select(Mandat))}
    n_m = 0
    for m in data.get("mandats", []):
        lid = m.get("avocat")
        d = m.get("date") or date.today().isoformat()
        key = (lid, m.get("ref", ""), d, m.get("assure", ""))
        if lid in ids and key not in existing:
            s.add(
                Mandat(
                    lawyer_id=lid,
                    ref=m.get("ref", ""),
                    date=date.fromisoformat(d),
                    assure=m.get("assure", ""),
                    adverse=m.get("adverse", ""),
                    matiere=m.get("matiere", ""),
                    note=m.get("note", ""),
                    statut=m.get("statut", "en cours"),
                    evaluation=int(m.get("eval") or 0),
                )
            )
            n_m += 1
    sign = (data.get("prefs") or {}).get("sign")
    if sign:
        s.merge(Setting(key="signature", value=sign))
    s.commit()
    return {"avocats": n_av, "mandats": n_m}
