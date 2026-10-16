"""Courrier d'attribution de mandat : modèle maison, ou rédaction adaptée par Claude."""

from datetime import date

from pydantic import BaseModel, Field

from . import ai
from . import domain as D
from .models import Lawyer

MOIS = [
    "janvier",
    "février",
    "mars",
    "avril",
    "mai",
    "juin",
    "juillet",
    "août",
    "septembre",
    "octobre",
    "novembre",
    "décembre",
]


class Dossier(BaseModel):
    ref: str = ""
    assure: str = ""
    adverse: str = ""
    objet: str = ""
    signature: str = ""


def date_fr(d: date) -> str:
    return f"{d.day}{'er' if d.day == 1 else ''} {MOIS[d.month - 1]} {d.year}"


def template(a: Lawyer, nom: str, d: Dossier) -> str:
    ref = d.ref or "[référence]"
    assure = d.assure or "[nom de l'assuré·e]"
    objet = d.objet or "[objet du litige]"
    sign = d.signature or "[collaborateur·rice]"
    concerne = f"{assure}{' c/ ' + d.adverse if d.adverse else ''} — {objet}"
    return f"""Orion Protection Juridique SA
Lausanne

Recommandé
Étude {nom}
{D.first_city(a.ville)}

Lausanne, le {date_fr(date.today())}

Concerne : {concerne}
Notre référence : {ref}

Maître,

Nous représentons les intérêts de {assure}, au bénéfice d'une police de protection juridique auprès de \
notre compagnie, dans le litige cité en marge.

Après examen du dossier, nous souhaitons vous en confier la défense, cette affaire relevant de votre \
domaine d'activité ({a.domaine}).

Nous vous saurions gré de bien vouloir nous confirmer, par retour de courrier, votre acceptation du présent \
mandat ainsi que l'absence de tout conflit d'intérêts.

Vos honoraires seront pris en charge sur la base d'un tarif horaire de {D.chf_tarif(a.tarif)}, étant précisé \
que toute démarche extraordinaire devra faire l'objet de notre accord préalable. Nous vous laissons le soin \
de nous adresser vos notes d'honoraires intermédiaires accompagnées d'un relevé détaillé des opérations.

Nous restons à votre disposition pour tout complément d'information et vous adressons, cher Maître, nos \
meilleurs messages.

Orion Protection Juridique SA

{sign}"""


class Lettre(BaseModel):
    texte: str = Field(description="Le courrier complet, prêt à copier dans Word")


SYSTEM = """Tu rédiges des courriers d'attribution de mandat pour Orion Protection Juridique SA (Lausanne), \
en français de Suisse romande. Reprends la structure et les conventions du modèle fourni : en-tête, \
« Concerne », « Maître, », demande de confirmation de l'absence de conflit d'intérêts, tarif horaire en \
CHF avec tiret (CHF 250.—), formule de politesse « nos meilleurs messages ». Adapte seulement le paragraphe \
qui présente l'affaire à l'objet du litige, en deux ou trois phrases factuelles, sans rien inventer \
(montants, dates, faits). Laisse entre crochets ce qui manque."""


def with_ai(a: Lawyer, nom: str, d: Dossier) -> str:
    prompt = (
        f"<modele>\n{template(a, nom, d)}\n</modele>\n\n<dossier>\nRéférence : {d.ref}\nAssuré·e : {d.assure}"
        f"\nPartie adverse : {d.adverse}\nObjet du litige : {d.objet}\n</dossier>"
    )
    return ai.parse(SYSTEM, prompt, Lettre).texte
