from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import HTTPException

from .normalize import normalize_annotation
from .storage import connect_db, now_iso
from .validation import validate_annotation


def parse_jsonl(content: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line_no, line in enumerate(content.splitlines(), start=1):
        if not line.strip():
            continue
        try:
            rows.append(json.loads(line))
        except json.JSONDecodeError as exc:
            raise HTTPException(status_code=400, detail=f"Invalid JSONL at line {line_no}") from exc
    return rows


def import_rows(rows: list[dict[str, Any]], draft_path: str) -> dict[str, Any]:
    prepared: list[dict[str, Any]] = []
    for row in rows:
        data = normalize_annotation(row)
        validate_annotation(data)
        prepared.append(data)
    with connect_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)",
            ("current_draft_path", str(Path(draft_path).resolve())),
        )
        conn.execute("DELETE FROM current_draft_images")
        for position, data in enumerate(prepared):
            conn.execute(
                "INSERT INTO current_draft_images (position, image_id) VALUES (?, ?)",
                (position, data["image_id"]),
            )
        for data in prepared:
            conn.execute(
                "INSERT OR REPLACE INTO annotations (image_id, payload_json, updated_at) VALUES (?, ?, ?)",
                (data["image_id"], json.dumps(data, ensure_ascii=False), now_iso()),
            )
    return {"imported": len(prepared)}


def sync_current_draft_jsonl() -> None:
    with connect_db() as conn:
        path_row = conn.execute("SELECT value FROM app_state WHERE key = ?", ("current_draft_path",)).fetchone()
        if not path_row:
            return
        rows = conn.execute(
            """
            SELECT annotations.payload_json
            FROM current_draft_images
            JOIN annotations ON annotations.image_id = current_draft_images.image_id
            ORDER BY current_draft_images.position
            """
        ).fetchall()
    lines = [json.dumps(normalize_annotation(json.loads(payload_json)), ensure_ascii=False) for (payload_json,) in rows]
    Path(path_row[0]).write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8-sig", newline="\n")
