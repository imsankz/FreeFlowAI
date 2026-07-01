# Python Integration for FreeFlowAI

A ready-to-use Python integration for FreeFlowAI — an OpenAI-compatible API proxy that uses multiple free/cheap API providers to reduce costs.

## What you get

1. `freeflowai.py` - Main integration module
2. `README.md` - Usage instructions
3. `config.toml.example` - Configuration example

## How to use this skill

1. Copy the files from `samples/python/` into your Python project
2. Modify your configuration system to include FreeFlowAI settings
3. Call `freeflowai.generate()` as shown in the examples

## Features

- **OpenAI-compatible API** - Works with any OpenAI SDK or HTTP client
- **Structured output support** - Handles JSON responses with fallback mechanisms
- **Robust field mapping** - Moves model responses to your data model (e.g., UploadPlan)
- **Fallback values** - Provides defaults for missing fields

## Configuration

Add this to your `config.py`:

```python
from dataclasses import dataclass

@dataclass(frozen=True)
class Config:
    # Existing fields...
    freeflowai_base_url: str = "http://localhost:8787/v1"
    freeflowai_model: str = "gpt-4"
```

## Example code

```python
import requests
from freeflowai import generate

# Configuration
BASE_URL = "http://localhost:8787/v1"
MODEL = "gpt-4"

# Call FreeFlowAI
result = generate(
    base_url=BASE_URL,
    model=MODEL,
    transcript=transcript,
    meta=metadata,
    note="Optional note",
    title_hint="Optional title hint",
    source_url="Optional source URL",
)

print("Generated plan:", result)
```

## Supported use cases

- **Content generation** (YouTube titles, descriptions, tags)
- **Transcript processing**
- **Structured data generation**
- **Cost-effective AI calls** (uses free/cheap API providers)

## Requirements

- `requests` library (available in most Python environments)
- FreeFlowAI proxy running at `http://localhost:8787` (start with `npm run dev`)
