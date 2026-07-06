#!/usr/bin/env python3
"""Start the LiteLLM proxy server."""
import os
import subprocess
import sys
from pathlib import Path

# Create data directory for SQLite databases
Path("data").mkdir(exist_ok=True)

# Set defaults if not provided
if "LITELLM_DATABASE_URL" not in os.environ:
    os.environ["LITELLM_DATABASE_URL"] = "sqlite:///./data/litellm.db"

if "LITELLM_MASTER_KEY" not in os.environ:
    print("ERROR: LITELLM_MASTER_KEY environment variable is required", file=sys.stderr)
    sys.exit(1)

port = os.environ.get("LITELLM_PORT", "8000")
config_path = os.path.join(os.path.dirname(__file__), "config.yaml")

print(f"Starting LiteLLM proxy on port {port}...")
print(f"Config: {config_path}")

result = subprocess.run(
    [sys.executable, "-m", "litellm", "--port", port, "--config", config_path],
    check=False,
)
sys.exit(result.returncode)
