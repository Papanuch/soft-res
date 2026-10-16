# Soft - Res

App de bureau (FastAPI + SQLite + React) pour le réseau d'avocats externes de Zsolt. Textes de l'interface et commentaires en français.

- L'interface compilée `soft_res/static/` est versionnée : après toute modification de `frontend/src`, lancer `npm run build` dans `frontend/` et committer `soft_res/static/` avec le reste, sinon ni Windows ni Vercel ne voient le changement.
- Vérifier avant de pousser : `uv run ruff check . && uv run ruff format --check . && uv run pytest` et `npm run build` (tsc strict).
- Claude ne reçoit jamais les noms réels : l'annuaire lui est envoyé avec des ids seulement (voir `assistant.py`).
- Démo en ligne sur Vercel (`[tool.vercel]` dans pyproject) : variable `SOFTRES_DEMO_PASSWORD`, pas de clé Anthropic, données dans `/tmp` (non conservées).
