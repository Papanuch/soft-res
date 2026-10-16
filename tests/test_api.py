from soft_res.conflicts import similarity
from soft_res.search import parse_nl


def search(client, **f):
    r = client.post("/api/annuaire", json=f)
    assert r.status_code == 200, r.text
    return r.json()


def test_seed_and_stats(client):
    data = search(client)
    assert data["total"] == 71 and len(data["avocats"]) == 71
    st = client.get("/api/stats").json()
    assert st["avocats"] == 71 and st["cantons"] == 7
    assert st["par_canton"]["VD"]["n"] == 36


def test_filters(client):
    vd_travail = search(client, cantons=["VD"], specs=["Droit du travail"])["avocats"]
    assert vd_travail and all(a["canton"] == "VD" and "Droit du travail" in a["specs"] for a in vd_travail)
    cheap = search(client, tarif_max=250)["avocats"]
    assert cheap and all(a["tarif_min"] <= 250 for a in cheap)
    near = search(client, pres_de="1003", rayon=15)
    assert near["pres_de"]["label"].startswith("1003")
    dists = [a["distance"] for a in near["avocats"]]
    assert dists == sorted(dists) and all(d <= 15 for d in dists)


def test_natural_language():
    p = parse_nl("licenciement Lausanne 20 km max 280 FSA")
    assert p.filters.specs == ["Droit du travail"]
    assert p.filters.pres_de == "Lausanne" and p.filters.rayon == 20
    assert p.filters.tarif_max == 280 and p.filters.fsa


def test_favori_note_mandat_rotation(client):
    first = search(client)["avocats"][0]["id"]
    assert client.put(f"/api/avocats/{first}/favori", json={"on": True}).status_code == 200
    assert client.put(f"/api/avocats/{first}/note", json={"texte": "Très réactif"}).status_code == 200
    m = client.post(
        "/api/mandats",
        json={
            "lawyer_id": first,
            "ref": "D-1",
            "assure": "Jean Martin",
            "adverse": "Régie Dupont SA",
            "note": "loyer impayé",
        },
    ).json()
    assert m["matiere"] == "Bail"
    fiche = client.get(f"/api/avocats/{first}").json()
    assert fiche["avocat"]["favori"] and fiche["avocat"]["note"] == "Très réactif"
    assert fiche["avocat"]["mandats"] == 1
    rot = search(client, tri="rotation")["avocats"]
    assert rot[-1]["id"] == first  # le seul avocat déjà mandaté passe en dernier


def test_conflicts_fuzzy(client):
    lid = search(client)["avocats"][0]["id"]
    client.post(
        "/api/mandats",
        json={"lawyer_id": lid, "ref": "D-9", "assure": "Jean Martin", "adverse": "Régie Dupont SA"},
    )
    hits = client.get("/api/conflits", params={"nom": "REGIE DUPONT S.A."}).json()
    assert hits and hits[0]["role"] == "partie adverse"
    # L'adverse d'hier devient l'assurée : conflit pour le même avocat.
    res = client.post("/api/conflits/avocat", json={"lawyer_id": lid, "assure": "Dupont Régie"}).json()
    assert res and "partie adverse" in res[0]
    assert similarity("Régie Dupont SA", "Dupont Régie") >= 86


def test_assistant_rules_and_ai_fallback(client):
    r = client.post("/api/assistant/regles", json={"spec": "Bail", "lieu": "Lausanne", "budget": 280}).json()
    assert r["moteur"] == "regles" and r["classement"]
    top = r["classement"][0]
    assert "Bail" in top["avocat"]["specs"] or "Généraliste" in top["avocat"]["specs"]
    # Sans clé : l'assistant IA retombe sur les règles et le dit.
    r = client.post("/api/assistant/ia", json={"demande": "litige de bail à Morges, budget 250"}).json()
    assert r["moteur"] == "regles" and "indisponible" in r["avertissement"]
    assert r["criteres"]["spec"] == "Bail"


def test_courrier_and_conflict_banner(client):
    lid = search(client)["avocats"][0]["id"]
    client.post(
        "/api/mandats", json={"lawyer_id": lid, "ref": "D-2", "assure": "ACME Sàrl", "adverse": "Paul"}
    )
    r = client.post(
        "/api/courrier", json={"lawyer_id": lid, "dossier": {"ref": "X-1", "assure": "Paul", "objet": "Bail"}}
    ).json()
    assert "Notre référence : X-1" in r["texte"] and r["moteur"] == "modele"
    assert r["conflits"]


def test_backup_roundtrip_and_orion_import(client):
    lid = search(client)["avocats"][3]["id"]
    old = {
        "orion": "local-data",
        "version": 10,
        "favs": [lid],
        "notes": {str(lid): "note v10"},
        "mandats": [
            {
                "id": 1,
                "avocat": lid,
                "ref": "OLD-1",
                "date": "2026-05-02",
                "assure": "A",
                "adverse": "B",
                "statut": "clos",
                "eval": 4,
            }
        ],
        "overrides": {
            "added": [
                {
                    "id": 1000,
                    "canton": "VD",
                    "avocat": "Me Nouveau",
                    "ville": "Nyon",
                    "tarif": "260",
                    "domaine": "Bail",
                    "tel": "",
                }
            ],
            "edits": {},
            "removed": [5],
        },
        "prefs": {"sign": "Zsolt"},
    }
    r = client.post("/api/sauvegarde", json={"data": old}).json()
    assert r == {"avocats": 1, "mandats": 1}
    data = search(client)
    assert len(data["avocats"]) == 71  # +1 ajouté, -1 retiré
    fiche = client.get(f"/api/avocats/{lid}").json()["avocat"]
    assert fiche["favori"] and fiche["evaluation"] == 4.0
    assert client.get("/api/reglages").json()["signature"] == "Zsolt"
    dump = client.get("/api/sauvegarde").json()
    assert dump["format"] == "soft-res" and len(dump["mandats"]) == 1
    # Réimport de sa propre sauvegarde : rien en double.
    assert client.post("/api/sauvegarde", json={"data": dump}).json() == {"avocats": 0, "mandats": 0}


def test_csv(client):
    r = client.get("/api/export.csv")
    assert r.status_code == 200 and r.text.count("\n") == 72


def test_privacy_wrong_pass(client):
    r = client.post("/api/noms/deverrouiller", json={"phrase": "pas la bonne"})
    assert r.status_code == 403


def test_decrypt_matches_webcrypto_format():
    """Bloc chiffré par WebCrypto (comme l'ancienne app) : déchiffrable ici, à l'identique."""
    import json
    from pathlib import Path

    import pytest

    from soft_res.privacy import WrongPassphrase, decrypt_block

    block = json.loads((Path(__file__).parent / "webcrypto_block.json").read_text())
    assert decrypt_block("phrase de test", block) == ["Me Réel Un", "Étude Deux"]
    with pytest.raises(WrongPassphrase):
        decrypt_block("mauvaise", block)


def test_real_names_unlock(client, monkeypatch, tmp_path):
    import json
    from pathlib import Path

    from soft_res import privacy

    src = json.loads((Path(__file__).parent / "webcrypto_block.json").read_text())
    f = tmp_path / "enc.json"
    f.write_text(json.dumps(src))
    monkeypatch.setattr(privacy, "ENC_FILE", f)
    assert client.post("/api/noms/deverrouiller", json={"phrase": "phrase de test"}).json() == {"noms": 2}
    names = [a["nom"] for a in search(client, tri="nom")["avocats"]]
    assert "Me Réel Un" in names and "Étude Deux" in names
    client.post("/api/noms/verrouiller")
    assert "Me Réel Un" not in [a["nom"] for a in search(client)["avocats"]]
