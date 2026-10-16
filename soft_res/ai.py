"""Appels à Claude (API Anthropic). Tout fonctionne aussi sans clé : les appelants
retombent alors sur les règles locales.

Ce qui part chez Anthropic : la demande tapée, l'annuaire tel qu'il est stocké (noms
anonymisés, jamais les noms réels déchiffrés) et, pour un courrier, les champs du dossier.
"""

from functools import lru_cache

import anthropic
from pydantic import BaseModel

from .config import settings


class AIUnavailable(Exception):
    """Pas de clé, refus, ou erreur réseau : l'appelant passe en mode sans IA."""


@lru_cache
def client() -> anthropic.Anthropic:
    return anthropic.Anthropic(api_key=settings().anthropic_api_key, max_retries=2, timeout=90)


def parse[T: BaseModel](
    system: str, prompt: str, schema: type[T], *, effort: str = "low", max_tokens: int = 16000
) -> T:
    """Un appel, une réponse validée par le schéma Pydantic (structured outputs)."""
    if not settings().ai_enabled:
        raise AIUnavailable("Aucune clé Anthropic dans le fichier .env")
    try:
        r = client().beta.messages.parse(
            model=settings().softres_model,
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            output_format=schema,
            output_config={"effort": effort},
            # Si le modèle décline par prudence, l'API relance la même requête sur un modèle de repli.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
    except anthropic.AuthenticationError as e:
        raise AIUnavailable("Clé Anthropic refusée : vérifiez le fichier .env") from e
    except anthropic.PermissionDeniedError as e:
        raise AIUnavailable("Clé sans accès à ce modèle, ou crédit épuisé") from e
    except anthropic.RateLimitError as e:
        raise AIUnavailable("Trop de requêtes pour le moment, réessayez dans une minute") from e
    except anthropic.APIStatusError as e:
        raise AIUnavailable(f"Erreur de l'API Anthropic ({e.status_code})") from e
    except anthropic.APIConnectionError as e:
        raise AIUnavailable("Pas de connexion à l'API Anthropic") from e
    if r.stop_reason == "refusal":
        raise AIUnavailable("Demande déclinée par le modèle")
    if r.stop_reason == "max_tokens" or r.parsed_output is None:
        raise AIUnavailable("Réponse incomplète du modèle")
    return r.parsed_output
