# Python Integration for FreeFlowAI

This is a Python sample integration for FreeFlowAI — an OpenAI-compatible proxy that uses multiple free/cheap API providers in a cascading manner to reduce costs.

## Features

- OpenAI-compatible API call wrapper
- Handles structured JSON output
- Fallbacks for missing fields
- Easy integration into Python projects

## Usage

1. Copy `freeflowai.py` into your project
2. Modify `config.py` (or your configuration system) to include FreeFlowAI settings
3. Use `freeflowai.generate()` instead of your current AI generation function

## Configuration

Add these to your config:

```toml
# FreeFlowAI
freeflowai_base_url = "http://localhost:8787/v1"
freeflowai_model = "gpt-4"
```

## Example Usage

```python
from eri_upload import config as config_mod
from eri_upload import freeflowai

# Load configuration
cfg = config_mod.load()

# Call FreeFlowAI
plan = freeflowai.generate(
    base_url=cfg.freeflowai_base_url,
    model=cfg.freeflowai_model,
    transcript=transcript,
    meta=meta,
    note=note,
    title_hint=title_hint,
    source_url=source_url,
)
```

## How it Works

The `freeflowai.generate()` function:
1. Sends a structured request to the FreeFlowAI proxy
2. Handles possible response formats (including wrapped responses)
3. Maps the response to your data model (e.g., UploadPlan)
4. Provides fallbacks for missing fields to ensure robustness

## Project Structure

```
your-project/
└── your_module/
    ├── config.py          # Configuration file with FreeFlowAI settings
    ├── freeflowai.py      # Integration module (from this sample)
    └── your_code.py       # Your code calling freeflowai.generate()
```

## Notes

- Make sure the FreeFlowAI proxy is running locally at `http://localhost:8787`
- You can start the proxy with `cd /path/to/FreeFlowAI && npm run dev`
- For production, you may want to host the proxy on a remote server
