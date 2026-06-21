from __future__ import annotations

import json
from pathlib import Path

from fastapi import HTTPException

from .config import APP_ROOT
from .storage import connect_db


def image_file_for_id(image_id: str) -> Path:
    with connect_db() as conn:
        row = conn.execute("SELECT payload_json FROM annotations WHERE image_id = ?", (image_id,)).fetchone()
    if row:
        payload = json.loads(row[0])
        image_path = payload.get("image_path")
        if image_path:
            path = (APP_ROOT / image_path).resolve()
            if not path.exists():
                path = (APP_ROOT.parent / image_path).resolve()
            if path.exists() and path.is_file():
                return path
    raise HTTPException(status_code=404, detail=f"Image not found: {image_id}")
