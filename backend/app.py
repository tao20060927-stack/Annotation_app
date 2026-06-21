from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from .config import EXPORT_DIR
from .importer import import_rows, parse_jsonl, sync_current_draft_jsonl
from .media import image_file_for_id
from .normalize import normalize_annotation
from .schemas import AnnotationPayload, ImportPayload
from .storage import connect_db, now_iso
from .validation import validate_annotation


app = FastAPI(title="Fine-grained Benchmark Annotation App")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/images")
def get_images() -> dict[str, Any]:
    with connect_db() as conn:
        rows = conn.execute(
            """
            SELECT annotations.image_id, annotations.payload_json
            FROM current_draft_images
            JOIN annotations ON annotations.image_id = current_draft_images.image_id
            ORDER BY current_draft_images.position
            """
        ).fetchall()
    images = []
    for image_id, payload_json in rows:
        payload = normalize_annotation(json.loads(payload_json))
        images.append({
            "image_id": image_id,
            "filename": Path(payload.get("image_path", image_id)).name,
            "image_path": payload.get("image_path", ""),
            "annotation_status": payload.get("annotation_status", "in_progress"),
        })
    return {"image_dir": "", "images": images}


@app.get("/api/images/{image_id}/file")
def get_image_file(image_id: str) -> FileResponse:
    return FileResponse(image_file_for_id(image_id))


@app.get("/api/annotations/{image_id}")
def get_annotation(image_id: str) -> dict[str, Any]:
    with connect_db() as conn:
        row = conn.execute("SELECT payload_json FROM annotations WHERE image_id = ?", (image_id,)).fetchone()
    if row:
        return normalize_annotation(json.loads(row[0]))
    raise HTTPException(status_code=404, detail=f"Annotation not found: {image_id}")


@app.put("/api/annotations/{image_id}")
def save_annotation(image_id: str, payload: AnnotationPayload) -> dict[str, Any]:
    if payload.image_id != image_id:
        raise HTTPException(status_code=400, detail="URL image_id and payload image_id mismatch")
    data = payload.model_dump()
    validate_annotation(data)
    with connect_db() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO annotations (image_id, payload_json, updated_at) VALUES (?, ?, ?)",
            (image_id, json.dumps(data, ensure_ascii=False), now_iso()),
        )
    sync_current_draft_jsonl()
    return {"saved": True, "image_id": image_id}


@app.post("/api/import")
def import_jsonl(payload: ImportPayload) -> dict[str, Any]:
    if not payload.path:
        raise HTTPException(status_code=400, detail="Provide JSON body with path")
    import_path = payload.path.strip().strip('"').strip("'")
    content = Path(import_path).read_text(encoding="utf-8-sig")
    return import_rows(parse_jsonl(content), import_path)


@app.post("/api/export")
def export_jsonl() -> dict[str, Any]:
    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    export_path = EXPORT_DIR / "annotations.jsonl"
    count = 0
    with connect_db() as conn, export_path.open("w", encoding="utf-8-sig", newline="\n") as f:
        rows = conn.execute("SELECT payload_json FROM annotations ORDER BY image_id").fetchall()
        for (payload_json,) in rows:
            f.write(json.dumps(normalize_annotation(json.loads(payload_json)), ensure_ascii=False) + "\n")
            count += 1
    return {"exported": count, "path": str(export_path)}
