#!/usr/bin/env python3
"""Start the LiteLLM proxy server."""
import os
import subprocess
import sys
import shutil
from pathlib import Path

# Create data directory
Path("data").mkdir(exist_ok=True)

if "LITELLM_MASTER_KEY" not in os.environ:
    print("ERROR: LITELLM_MASTER_KEY environment variable is required", file=sys.stderr)
    sys.exit(1)

port = os.environ.get("LITELLM_PORT", "8000")
config_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "config.yaml")

# Ensure the callback knows where to reach the Qillin API server.
# The API server artifact is pinned to port 8080 in its artifact.toml.
if "QILLIN_INTERNAL_URL" not in os.environ:
    os.environ["QILLIN_INTERNAL_URL"] = "http://localhost:8080"
pythonlibs = "/home/runner/workspace/.pythonlibs"


# Add pythonlibs bin to PATH so prisma and litellm are findable
os.environ["PATH"] = f"{pythonlibs}/bin:" + os.environ.get("PATH", "")

print(f"Starting LiteLLM proxy on port {port}...")

# Run prisma generate (required before first start)
prisma_bin = shutil.which("prisma") or f"{pythonlibs}/bin/prisma"
if os.path.isfile(prisma_bin):
    print("Running prisma generate...")
    subprocess.run([prisma_bin, "generate", "--schema",
                    f"{pythonlibs}/lib/python3.13/site-packages/litellm/proxy/schema.prisma"],
                   check=False, capture_output=True)
else:
    print("Warning: prisma binary not found, skipping prisma generate", file=sys.stderr)

# Find and launch litellm
litellm_bin = shutil.which("litellm") or f"{pythonlibs}/bin/litellm"
print(f"Using litellm: {litellm_bin}")
result = subprocess.run(
    [litellm_bin, "--port", port, "--host", "127.0.0.1", "--config", config_path],
    check=False,
)
sys.exit(result.returncode)
