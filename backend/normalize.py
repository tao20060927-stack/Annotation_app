from __future__ import annotations

from typing import Any

from fastapi import HTTPException


def default_annotation(image_id: str, image_path: str) -> dict[str, Any]:
    return {
        "image_id": image_id,
        "image_path": image_path,
        "source_dataset": None,
        "split": None,
        "source_image_id": image_id,
        "annotation_status": "in_progress",
        "width": 0,
        "height": 0,
        "objects": [],
        "questions": [],
    }


def normalize_annotation(row: dict[str, Any]) -> dict[str, Any]:
    image_id = str(row.get("image_id") or row.get("source_image_id") or "").strip()
    if not image_id:
        raise HTTPException(status_code=400, detail="Imported row requires image_id or source_image_id")
    image_path = str(row.get("image_path") or f"images/{image_id}.jpg")
    normalized = {
        "source_dataset": row.get("source_dataset"),
        "split": row.get("split"),
        "image_id": image_id,
        "source_image_id": str(row.get("source_image_id") or image_id),
        "image_path": image_path,
        "width": int(row.get("width") or 0),
        "height": int(row.get("height") or 0),
        "annotation_status": row.get("annotation_status") or "in_progress",
        "objects": row.get("objects") or [],
        "questions": row.get("questions") or [],
    }
    for key, value in row.items():
        if key not in normalized:
            normalized[key] = value
    return normalized
