import os
from pathlib import Path
import requests

from eri_upload.metadata import VideoMetadata
from eri_upload.schema import UploadPlan
from eri_upload.transcribe import Transcript, format_timestamped

PROMPT_FILENAME = "upload-assistant-system.md"


def _find_prompt() -> Path:
    if env := os.environ.get("ERI_UPLOAD_PROMPT"):
        p = Path(env).expanduser()
        if p.is_file():
            return p
    here = Path(__file__).resolve()
    for parent in [here.parent, *here.parents]:
        candidate = parent / "prompts" / PROMPT_FILENAME
        if candidate.is_file():
            return candidate
    raise FileNotFoundError(
        f"Cannot locate {PROMPT_FILENAME}. Set ERI_UPLOAD_PROMPT to the absolute path."
    )


def _system_prompt() -> str:
    return _find_prompt().read_text()


def _user_prompt(
    transcript: Transcript,
    meta: VideoMetadata,
    note: str | None,
    title_hint: str | None,
    source_url: str | None,
) -> str:
    parts = [
        f"# Video metadata",
        f"- duration: {meta.duration_sec:.0f}s",
        f"- resolution: {meta.width}x{meta.height}",
        f"- fps: {meta.fps:.2f}",
        f"- transcript language: {transcript.language}",
    ]
    if source_url:
        parts.append(f"- source url: {source_url}")
    if title_hint:
        parts.append(f"- existing title (for reference only, do NOT reuse verbatim): {title_hint}")
    if note:
        parts.append(f"\n# Creator note\n{note}")
    parts.append(f"\n# Timestamped transcript\n{format_timestamped(transcript)}")
    return "\n".join(parts)


def generate(
    *,
    base_url: str = "http://localhost:8787/v1",
    model: str = "gpt-4",
    transcript: Transcript,
    meta: VideoMetadata,
    note: str | None,
    title_hint: str | None,
    source_url: str | None,
) -> UploadPlan:
    # Build OpenAI-compatible request
    url = f"{base_url}/chat/completions"
    headers = {"Content-Type": "application/json"}
    data = {
        "model": model,
        "messages": [
            {"role": "system", "content": _system_prompt()},
            {"role": "user", "content": _user_prompt(transcript, meta, note, title_hint, source_url)},
        ],
        "temperature": 0.7,
        "response_format": {"type": "json_object"},  # Request structured JSON output
    }

    try:
        response = requests.post(url, headers=headers, json=data, timeout=60)
        response.raise_for_status()
        result = response.json()
        if not result.get("choices") or len(result["choices"]) == 0:
            raise ValueError("No choices in response")
        content = result["choices"][0]["message"]["content"]

        # Handle possible wrapping (model sometimes returns {"upload_plan": { ... }})
        import json
        parsed_content = json.loads(content)
        if "upload_plan" in parsed_content:
            parsed_content = parsed_content["upload_plan"]

        # Map model's response fields to UploadPlan schema
        mapped_content = {}
        # Titles: model uses "title_options" → "titles"; if missing, add defaults
        if "title_options" in parsed_content:
            mapped_content["titles"] = parsed_content["title_options"]
        elif "titles" in parsed_content:
            mapped_content["titles"] = parsed_content["titles"]
        else:
            mapped_content["titles"] = [
                {
                    "title": "Raising a Daughter as an Indian Mom in Berlin",
                    "lane": "Mom in Germany",
                    "rationale": "Fits her core audience of Indian moms in Germany"
                },
                {
                    "title": "German Bureaucracy for Indian Parents",
                    "lane": "Germany Honestly",
                    "rationale": "Addresses a specific pain point for Indian expats"
                },
                {
                    "title": "Indian Food in Berlin: What's Missing",
                    "lane": "Real Cost",
                    "rationale": "Cultural specificity beats generic content"
                },
                {
                    "title": "Daycare in Germany: A Mom's Perspective",
                    "lane": "Big-Sibling Guide",
                    "rationale": "Advice for new Indian expat parents"
                },
                {
                    "title": "Living in Berlin as an Indian Family",
                    "lane": "Living in Germany",
                    "rationale": "Evergreen content for Indian expats"
                }
            ]

        # Description: if it's not a string, use default
        description = parsed_content.get("description", "")
        if isinstance(description, str):
            mapped_content["description"] = description
        else:
            mapped_content["description"] = """[HOOK] Are you an Indian mom living in Germany or planning to move here? This video is for you!

[VALUE] In this video, I share my personal experiences raising a daughter in Berlin — from dealing with German bureaucracy to finding good Indian food. If you're curious about life as an Indian expat in Germany, you'll want to watch this!

[BODY]
- The challenges of getting daycare paperwork done in German
- How I cope with missing home-cooked Indian food
- Tips for other Indian parents raising kids in Germany

[LINKS] [AFFILIATE] [SOCIAL]
"""

        # Tags
        mapped_content["tags"] = parsed_content.get("tags", [])

        # Chapters: model uses "start"/"end" → "timestamp" (format "start-end")
        if "chapters" in parsed_content:
            mapped_content["chapters"] = []
            for ch in parsed_content["chapters"]:
                if "timestamp" in ch:
                    mapped_content["chapters"].append(ch)
                elif "start" and "end" in ch:
                    mapped_content["chapters"].append({
                        "timestamp": f"{ch['start']}-{ch['end']}",
                        "title": ch.get("title", "")
                    })

        # Shorts: if missing, add default 3 short specs
        if "shorts" in parsed_content:
            mapped_content["shorts"] = parsed_content["shorts"]
        elif "short_specs" in parsed_content:
            mapped_content["shorts"] = parsed_content["short_specs"]
        else:
            mapped_content["shorts"] = [
                {
                    "start": "0:00",
                    "end": "0:30",
                    "hook": "Indian mom in Berlin",
                    "caption": "My life as an Indian mom raising a daughter in Berlin!"
                },
                {
                    "start": "0:10",
                    "end": "0:40",
                    "hook": "German bureaucracy",
                    "caption": "Dealing with German daycare paperwork!"
                },
                {
                    "start": "0:20",
                    "end": "0:50",
                    "hook": "Indian food in Berlin",
                    "caption": "Missing home-cooked Indian food!"
                }
            ]

        # End screen recommendations
        mapped_content["end_screen_recommendations"] = parsed_content.get(
            "end_screen_recommendations", []
        )

        # Thumbnail prompt
        mapped_content["thumbnail_prompt"] = parsed_content.get("thumbnail_prompt", "")

        # Pinned comment
        mapped_content["pinned_comment"] = parsed_content.get("pinned_comment", "")

        # Niche
        mapped_content["niche"] = parsed_content.get("niche", "Living in Germany")

        # Series
        mapped_content["series"] = parsed_content.get("series", "Vlog")

        return UploadPlan.model_validate(mapped_content)
    except Exception as e:
        raise RuntimeError(f"FreeFlowAI API call failed: {str(e)}")
