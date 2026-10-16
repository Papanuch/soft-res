"""Chemin IA, avec un faux serveur Anthropic : vérifie la requête envoyée et l'exploitation de la réponse."""

import json

import anthropic
import httpx2 as httpx
import pytest

from soft_res import ai, config


@pytest.fixture
def fake_claude(client, monkeypatch):
    sent = []

    def respond(answer: dict):
        def handler(request: httpx.Request) -> httpx.Response:
            sent.append({"body": json.loads(request.content), "headers": dict(request.headers)})
            return httpx.Response(
                200,
                json={
                    "id": "msg_test",
                    "type": "message",
                    "role": "assistant",
                    "model": "claude-opus-5-5",
                    "content": [{"type": "text", "text": json.dumps(answer)}],
                    "stop_reason": "end_turn",
                    "stop_sequence": None,
                    "usage": {"input_tokens": 10, "output_tokens": 10},
                },
            )

        c = anthropic.Anthropic(
            api_key="sk-ant-test", http_client=httpx.Client(transport=httpx.MockTransport(handler))
        )
        monkeypatch.setattr(ai, "client", lambda: c)

    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    config.settings.cache_clear()
    return respond, sent


def test_assistant_ai(client, fake_claude):
    respond, sent = fake_claude
    respond(
        {
            "criteres": {
                "spec": "Bail",
                "lieu": "Morges",
                "canton": None,
                "budget": 250,
                "fsa": False,
                "assure": "",
                "adverse": "Régie Dupont",
            },
            "choix": [
                {"id": 53, "argument": "Spécialiste du bail à Morges."},
                {"id": 9999, "argument": "inventé"},
                {"id": 45, "argument": "FSA bail à Lausanne."},
            ],
            "conseil": "Vérifier le délai de contestation.",
        }
    )
    r = client.post(
        "/api/assistant/ia", json={"demande": "bail à Morges contre la Régie Dupont, pas cher"}
    ).json()
    assert r["moteur"] == "ia" and r["conseil"]
    assert [x["avocat"]["id"] for x in r["classement"]] == [53, 45]  # l'id inventé est écarté
    assert r["classement"][0]["argument"] == "Spécialiste du bail à Morges."
    req = sent[0]
    assert req["body"]["model"] == "claude-opus-5-5"
    assert req["body"]["fallbacks"] == "default"
    assert req["body"]["output_config"]["effort"] == "low"
    assert req["body"]["output_config"]["format"]["type"] == "json_schema"
    assert "server-side-fallback-2026-07-01" in req["headers"]["anthropic-beta"]
    # Les noms ne partent pas : seuls les identifiants et caractéristiques de l'annuaire.
    assert "Sarine Lex" not in req["body"]["messages"][0]["content"]


def test_courrier_ai(client, fake_claude):
    respond, _ = fake_claude
    respond({"texte": "Courrier rédigé par Claude"})
    r = client.post(
        "/api/courrier",
        json={"lawyer_id": 0, "ia": True, "dossier": {"ref": "R1", "assure": "A", "objet": "Licenciement"}},
    ).json()
    assert r["moteur"] == "ia" and r["texte"] == "Courrier rédigé par Claude"
