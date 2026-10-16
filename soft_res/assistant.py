"""Assistant « Trouver le bon avocat ».

Deux moteurs pour un même résultat :
- règles locales : score transparent (domaine, lieu, budget, FSA, historique, conflits) ;
- Claude : comprend une demande libre, en déduit les critères et argumente un classement.
Le score local et le contrôle de conflit sont toujours calculés ici, jamais délégués à l'IA.
"""

from typing import Literal

from pydantic import BaseModel, Field
from sqlmodel import Session

from . import ai
from . import domain as D
from .conflicts import conflicts_for
from .search import LawyerView, all_views

SpecName = Literal[
    "Droit du travail",
    "Assurances & RC",
    "Construction / Immobilier",
    "Bail",
    "Pénal / LCR",
    "Contrats",
    "Généraliste",
]


class Criteria(BaseModel):
    spec: SpecName | None = None
    lieu: str = ""  # NPA ou ville
    canton: str | None = None
    budget: int | None = None  # tarif horaire max (CHF)
    fsa: bool = False
    assure: str = ""
    adverse: str = ""


class Ranked(BaseModel):
    avocat: LawyerView
    score: int
    raisons: list[str]
    conflit: list[str] = []
    argument: str = ""  # explication rédigée par Claude


class Result(BaseModel):
    criteres: Criteria
    resume: str
    classement: list[Ranked]
    conseil: str = ""
    moteur: Literal["ia", "regles"]
    avertissement: str = ""


def score(views: list[LawyerView], c: Criteria, s: Session) -> list[Ranked]:
    rx = D.SPECS.get(c.spec) if c.spec else None
    near = D.locate(c.lieu) if c.lieu else None
    budget = c.budget or 999
    out = []
    for v in views:
        pts, why = 0.0, []
        if rx:
            if rx.search(v.domaine):
                pts += 40
                why.append("Domaine ✓")
            elif "Généraliste" in v.specs:
                pts += 18
                why.append("Généraliste")
        else:
            pts += 20
        if near and v.lat is not None:
            dist = D.haversine(near["lat"], near["lon"], v.lat, v.lon)
            v.distance = round(dist, 1)
            pts += max(0.0, 30 * (1 - min(dist, 80) / 80))
            if dist <= 25:
                why.append(f"{dist:.0f} km")
        elif c.canton:
            if v.canton == c.canton:
                pts += 28
                why.append(v.canton_nom)
        else:
            pts += 14
        if v.tarif_min <= budget:
            pts += 16 + max(0, (300 if budget == 999 else budget) - v.tarif_min) / 10
            why.append(f"CHF {v.tarif.replace('-', '–')}.–/h")
        else:
            pts -= 25
        if c.fsa and v.fsa:
            pts += 12
            why.append("FSA")
        if v.evaluation:
            pts += (v.evaluation - 3) * 4
            why.append(f"★ {v.evaluation}")
        if v.en_cours >= 3:
            pts -= 6
            why.append(f"{v.en_cours} en cours")
        conflits = (
            [x.raison for x in conflicts_for(s, v.id, c.assure, c.adverse)] if (c.assure or c.adverse) else []
        )
        if conflits:
            pts -= 60
            why.append("⚠ conflit possible")
        out.append(Ranked(avocat=v, score=max(0, round(pts)), raisons=why, conflit=conflits))
    out = [r for r in out if r.score > 20]
    return sorted(out, key=lambda r: -r.score)[:7]


def resume(c: Criteria) -> str:
    p = [c.spec.split(" /")[0] if c.spec else "tous domaines"]
    p.append(f"autour de {c.lieu}" if c.lieu else D.CANTONS.get(c.canton or "", "toute la Suisse romande"))
    p.append(f"≤ CHF {c.budget}.—" if c.budget else "sans limite de tarif")
    if c.fsa:
        p.append("priorité FSA")
    return " · ".join(p)


def by_rules(s: Session, c: Criteria, avertissement: str = "") -> Result:
    return Result(
        criteres=c,
        resume=resume(c),
        classement=score(all_views(s), c, s),
        moteur="regles",
        avertissement=avertissement,
    )


# ── Avec Claude ──


class AIPick(BaseModel):
    id: int = Field(description="Identifiant de l'avocat dans l'annuaire fourni")
    argument: str = Field(description="Une ou deux phrases : pourquoi cet avocat pour ce dossier")


class AIAnswer(BaseModel):
    criteres: Criteria
    choix: list[AIPick] = Field(description="3 à 5 avocats, le meilleur d'abord")
    conseil: str = Field(description="Un conseil pratique pour ce dossier, une phrase, ou vide")


SYSTEM = """Tu assistes un juriste d'Orion Protection Juridique (Lausanne) qui confie des dossiers à des \
avocats partenaires en Suisse romande. À partir de sa demande, tu extrais les critères puis tu choisis \
les avocats les plus adaptés dans l'annuaire fourni, et uniquement dans celui-ci.

Critères : spec = une seule spécialité parmi la liste autorisée (la plus proche du litige) ; lieu = NPA ou \
ville du dossier si mentionné ; canton = code (VD, GE, NE, VS, JU, FR, BE) seulement si la demande vise un \
canton sans ville ; budget = tarif horaire maximal en CHF si exprimé (« pas cher » ≈ 250) ; fsa = vrai si \
un spécialiste certifié est demandé ou si l'enjeu le justifie clairement ; assure et adverse = noms des \
parties s'ils sont donnés.

Pour le choix, pèse : adéquation du domaine (un spécialiste FSA du domaine vaut mieux qu'un généraliste), \
proximité, tarif par rapport au budget, évaluations et charge actuelle (mandats en cours). Les avocats \
signalés en conflit possible sont à écarter. Rédige en français, sobrement, sans répéter les données brutes."""


def directory_for_ai(views: list[LawyerView]) -> str:
    lines = ["id | canton | ville | tarif CHF/h | domaines | mandats (en cours) | évaluation"]
    for v in views:
        lines.append(
            f"{v.id} | {v.canton} | {v.ville} | {v.tarif} | {v.domaine} | {v.mandats} ({v.en_cours}) | "
            f"{v.evaluation or '-'}"
        )
    return "\n".join(lines)


def by_ai(s: Session, demande: str) -> Result:
    views = all_views(s)
    prompt = f"<annuaire>\n{directory_for_ai(views)}\n</annuaire>\n\n<demande>\n{demande}\n</demande>"
    try:
        ans = ai.parse(SYSTEM, prompt, AIAnswer)
    except ai.AIUnavailable as e:
        from .search import parse_nl

        p = parse_nl(demande)
        f = p.filters if p else None
        c = Criteria(
            spec=f.specs[0] if f and f.specs else D.guess_spec(demande),
            lieu=f.pres_de if f else "",
            canton=f.cantons[0] if f and f.cantons else None,
            budget=f.tarif_max if f else None,
            fsa=f.fsa if f else False,
        )
        return by_rules(
            s, c, avertissement=f"Assistant IA indisponible ({e}) : classement par règles locales."
        )
    local = {r.avocat.id: r for r in score(views, ans.criteres, s)}
    by_id = {v.id: v for v in views}
    ranked = []
    for pick in ans.choix:
        v = by_id.get(pick.id)
        if not v:
            continue  # identifiant inventé : ignoré
        r = local.get(v.id) or Ranked(avocat=v, score=0, raisons=[])
        r.argument = pick.argument
        if not r.conflit and (ans.criteres.assure or ans.criteres.adverse):
            r.conflit = [x.raison for x in conflicts_for(s, v.id, ans.criteres.assure, ans.criteres.adverse)]
        ranked.append(r)
    return Result(
        criteres=ans.criteres,
        resume=resume(ans.criteres),
        classement=ranked,
        conseil=ans.conseil,
        moteur="ia",
    )
