---
name: LiteLLM callback file location
description: Custom callback modules must live in the same directory as config.yaml, not the repo root or any arbitrary path on PYTHONPATH.
---

## Rule
Place custom LiteLLM callback Python files in the **same directory as `config.yaml`** (i.e., `litellm-proxy/`).

LiteLLM's `get_instance_fn` in `litellm/proxy/types_utils/utils.py` constructs the module file path as:
```python
directory = os.path.dirname(config_file_path)   # e.g. /workspace/litellm-proxy
module_file_path = os.path.join(directory, *module_name.split(".")) + ".py"
```
It loads the file directly via `importlib.util.spec_from_file_location` — **not** via `importlib.import_module` and **not** via PYTHONPATH. Setting `PYTHONPATH` in the environment has no effect on this lookup.

**Why:** The `qillin_callback.py` was initially placed at the repo root. LiteLLM silently failed to find it (error: "Could not find module file ...") and wrapped it as `ImportError: Could not import qillin_logger from qillin_callback`, which obscured the root cause.

**How to apply:** When adding any new custom callback or middleware to the LiteLLM proxy, save the `.py` file in `litellm-proxy/` and reference it in `config.yaml` as `qillin_callback.qillin_logger` (module.class format, no path prefix needed).
