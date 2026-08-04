from __future__ import annotations

import shutil
import subprocess
import sys
from pathlib import Path


def find_npm() -> str:
    """Return the platform-specific npm executable."""
    candidates = ["npm.cmd", "npm"] if sys.platform == "win32" else ["npm"]
    for candidate in candidates:
        executable = shutil.which(candidate)
        if executable:
            return executable
    raise RuntimeError("npm was not found. Install Node.js before starting GitPilot.")


def main() -> int:
    app_root = Path(__file__).resolve().parent
    npm = find_npm()

    # GitPilot needs the renderer, Electron main process, and TypeScript watcher
    # running together, so the launcher uses the project's complete dev script.
    return subprocess.call([npm, "run", "dev"], cwd=app_root)


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except KeyboardInterrupt:
        raise SystemExit(130)
