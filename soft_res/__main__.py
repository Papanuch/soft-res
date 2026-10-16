"""Point d'entrée : `uv run soft-res` ouvre l'application dans une fenêtre Windows native.

Options :
  --navigateur   ouvre l'interface dans le navigateur au lieu d'une fenêtre dédiée
  --serveur      lance seulement le serveur (développement, port 8765)
"""

import socket
import sys
import threading
import time
import webbrowser

import uvicorn


def free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def serve(port: int) -> uvicorn.Server:
    server = uvicorn.Server(
        uvicorn.Config("soft_res.app:app", host="127.0.0.1", port=port, log_level="warning")
    )
    threading.Thread(target=server.run, daemon=True).start()
    deadline = time.monotonic() + 20
    while not server.started:
        if time.monotonic() > deadline:
            raise RuntimeError("Le serveur interne n'a pas démarré")
        time.sleep(0.05)
    return server


def main() -> None:
    args = set(sys.argv[1:])
    if "--serveur" in args:
        uvicorn.run("soft_res.app:app", host="127.0.0.1", port=8765, reload=True)
        return
    port = free_port()
    server = serve(port)
    url = f"http://127.0.0.1:{port}/"
    if "--navigateur" in args:
        webbrowser.open(url)
        print(f"Soft - Res tourne sur {url} — Ctrl+C pour quitter.")
        try:
            while True:
                time.sleep(3600)
        except KeyboardInterrupt:
            pass
    else:
        import webview  # pywebview : fenêtre native (Edge WebView2 sous Windows)

        webview.create_window("Soft - Res", url, width=1440, height=920, min_size=(1000, 680))
        webview.start()
    server.should_exit = True


if __name__ == "__main__":
    main()
