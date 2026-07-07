---
name: Qillin callback port
description: Root cause of request logs not incrementing / Qredits not decreasing — wrong port in LiteLLM callback default.
---

## Rule

`QILLIN_INTERNAL_URL` in `qillin_callback.py` must point at port **8080**, not 3001.  
All internal references to LiteLLM must use `http://127.0.0.1:8000`, not `http://localhost:8000`.

**Why:** The API server artifact is pinned to `localPort = 8080` in its `artifact.toml`. The old default of `3001` caused every post-request callback to fail silently with ECONNREFUSED, so activity_log was never written and Qredits never deducted. Additionally, LiteLLM binds to `127.0.0.1` (not `::`) via `--host 127.0.0.1`; using `localhost` risks IPv6-first resolution (`::1`) missing it.

**How to apply:** If the callback or sync ever stops working, check that `QILLIN_INTERNAL_URL` resolves to port 8080 and that `LITELLM_URL` resolves to `127.0.0.1:8000`. Never log raw request headers in the callback — log only header keys (auth token leakage risk).
