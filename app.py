from __future__ import annotations

import os
import shutil
import socket
import subprocess
import sys
from pathlib import Path

DEFAULT_RENDERER_PORT = 5173
PORT_SEARCH_LIMIT = 20


def find_npm() -> str:
    """Return the platform-specific npm executable."""
    candidates = ["npm.cmd", "npm"] if sys.platform == "win32" else ["npm"]
    for candidate in candidates:
        executable = shutil.which(candidate)
        if executable:
            return executable
    raise RuntimeError("npm was not found. Install Node.js before starting GitPilot.")


def is_port_available(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) != 0


def choose_renderer_port() -> int:
    configured = os.environ.get("GITPILOT_RENDERER_PORT")
    if configured:
        try:
            port = int(configured)
        except ValueError as error:
            raise RuntimeError("GITPILOT_RENDERER_PORT must be a valid port number.") from error
        if not 1 <= port <= 65535:
            raise RuntimeError("GITPILOT_RENDERER_PORT must be between 1 and 65535.")
        if not is_port_available(port):
            raise RuntimeError(f"Renderer port {port} is already in use.")
        return port

    for offset in range(PORT_SEARCH_LIMIT):
        port = DEFAULT_RENDERER_PORT + offset
        if is_port_available(port):
            return port

    raise RuntimeError(
        f"No available renderer port found in the range "
        f"{DEFAULT_RENDERER_PORT}-{DEFAULT_RENDERER_PORT + PORT_SEARCH_LIMIT - 1}."
    )


def main() -> int:
    app_root = Path(__file__).resolve().parent
    npm = find_npm()
    renderer_port = choose_renderer_port()
    environment = os.environ.copy()
    environment["GITPILOT_RENDERER_PORT"] = str(renderer_port)

    # GitPilot needs the renderer, Electron main process, and TypeScript watcher
    # running together, so the launcher uses the project's complete dev script.
    print(f"GitPilot renderer: http://127.0.0.1:{renderer_port}", flush=True)
    return subprocess.call([npm, "run", "dev"], cwd=app_root, env=environment)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
