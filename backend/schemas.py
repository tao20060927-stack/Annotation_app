from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class AnnotationPayload(BaseModel):
    image_id: str
    image_path: str
    source_dataset: str | None = None
    split: str | None = None
    source_image_id: str | None = None
    annotation_status: str = "in_progress"
    width: int
    height: int
    objects: list[dict[str, Any]]
    questions: list[dict[str, Any]]


class ImportPayload(BaseModel):
    path: str | None = None
