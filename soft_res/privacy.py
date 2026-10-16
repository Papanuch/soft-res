"""Noms réels : bloc chiffré (PBKDF2-SHA256 → AES-256-GCM), déchiffré en mémoire seulement.

Même format que l'ancienne application : la phrase de passe existante fonctionne telle quelle.
Rien n'est jamais écrit en clair sur le disque ; le verrouillage est automatique après
une période d'inactivité.
"""

import base64
import json
import threading
import time

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from .config import PACKAGE, settings

ENC_FILE = PACKAGE / "seed" / "noms_reels.enc.json"


class WrongPassphrase(Exception):
    pass


def _b64(s: str) -> bytes:
    return base64.b64decode(s)


def derive_key(passphrase: str, block: dict) -> bytes:
    kdf = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=_b64(block["salt"]), iterations=block["it"])
    return kdf.derive(passphrase.encode("utf-8"))


def decrypt_block(passphrase: str, block: dict) -> list[str]:
    try:
        plain = AESGCM(derive_key(passphrase, block)).decrypt(_b64(block["iv"]), _b64(block["ct"]), None)
    except InvalidTag as e:
        raise WrongPassphrase from e
    return json.loads(plain.decode("utf-8"))


class _Vault:
    def __init__(self) -> None:
        self._names: list[str] | None = None
        self._last = 0.0
        self._lock = threading.Lock()

    @property
    def available(self) -> bool:
        return ENC_FILE.exists()

    def _expired(self) -> bool:
        return time.monotonic() - self._last > settings().softres_lock_minutes * 60

    def names(self) -> list[str] | None:
        with self._lock:
            if self._names is not None and self._expired():
                self._names = None
            return self._names

    def touch(self) -> None:
        with self._lock:
            if self._names is not None:
                self._last = time.monotonic()

    def unlock(self, passphrase: str) -> int:
        block = json.loads(ENC_FILE.read_text(encoding="utf-8"))
        names = decrypt_block(passphrase, block)
        with self._lock:
            self._names, self._last = names, time.monotonic()
        return len(names)

    def lock(self) -> None:
        with self._lock:
            self._names = None


vault = _Vault()
