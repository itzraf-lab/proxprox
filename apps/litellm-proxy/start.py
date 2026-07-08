#!/usr/bin/env python3
"""Start the LiteLLM proxy server.

Portable launcher: discovers the LiteLLM Prisma schema and the `prisma` /
`litellm` binaries from the active Python environment (venv or system) — no
hardcoded paths. Run it with the environment that has `litellm[proxy]`
installed on PATH (see HOW_TO_RUN.md).
"""
import importlib.util
import os
import shutil
import subprocess
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent

if "LITELLM_MASTER_KEY" not in os.environ:
    print("ERROR: LITELLM_MASTER_KEY environment variable is required", file=sys.stderr)
    sys.exit(1)

# Data dir for any local files LiteLLM writes.
(SCRIPT_DIR / "data").mkdir(exist_ok=True)

port = os.environ.get("LITELLM_PORT", "8000")
config_path = str(SCRIPT_DIR / "config.yaml")

# Tell the success callback where to reach the Qillin API server.
os.environ.setdefault("QILLIN_INTERNAL_URL", "http://localhost:8080")

# The callback module (qillin_callback.py) lives next to config.yaml; make sure
# it is importable regardless of the current working directory.
os.environ["PYTHONPATH"] = os.pathsep.join(
    filter(None, [str(SCRIPT_DIR), os.environ.get("PYTHONPATH", "")])
)

print(f"Starting LiteLLM proxy on port {port}...")


def find_litellm_schema() -> str | None:
    """Locate LiteLLM's bundled Prisma schema inside the installed package."""
    spec = importlib.util.find_spec("litellm")
    if not spec or not spec.origin:
        return None
    schema = Path(spec.origin).parent / "proxy" / "schema.prisma"
    return str(schema) if schema.is_file() else None


# Run prisma generate (required before the first proxy start).
prisma_bin = shutil.which("prisma")
schema_path = find_litellm_schema()
if prisma_bin and schema_path:
    print("Running prisma generate...")
    subprocess.run(
        [prisma_bin, "generate", "--schema", schema_path],
        check=False,
        capture_output=True,
    )
else:
    print(
        "Warning: skipping prisma generate "
        f"(prisma={'found' if prisma_bin else 'missing'}, "
        f"schema={'found' if schema_path else 'missing'})",
        file=sys.stderr,
    )

# Find and launch litellm.
litellm_bin = shutil.which("litellm")
if not litellm_bin:
    print("ERROR: `litellm` not found on PATH. Install litellm[proxy] first.", file=sys.stderr)
    sys.exit(1)

print(f"Using litellm: {litellm_bin}")
result = subprocess.run(
    [litellm_bin, "--port", port, "--host", "127.0.0.1", "--config", config_path],
    check=False,
)
sys.exit(result.returncode)
