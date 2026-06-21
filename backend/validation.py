from __future__ import annotations

from typing import Any

from fastapi import HTTPException


def validate_bbox(bbox: Any, field_name: str) -> None:
    if not isinstance(bbox, list) or len(bbox) != 4:
        raise HTTPException(status_code=400, detail=f"{field_name} must be [x1, y1, x2, y2]")
    try:
        x1, y1, x2, y2 = [float(value) for value in bbox]
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=400, detail=f"{field_name} values must be numeric") from exc
    if x2 <= x1 or y2 <= y1:
        raise HTTPException(status_code=400, detail=f"{field_name} must have positive area")


def validate_annotation(payload: dict[str, Any]) -> None:
    if payload.get("annotation_status") not in {"in_progress", "complete"}:
        raise HTTPException(status_code=400, detail="annotation_status must be in_progress or complete")
    object_ids = set()
    detail_to_object: dict[str, str] = {}
    for obj in payload.get("objects", []):
        if "category" in obj:
            raise HTTPException(status_code=400, detail="Object must not contain category")
        object_id = obj.get("object_id")
        if not object_id:
            raise HTTPException(status_code=400, detail="Object object_id is required")
        object_ids.add(object_id)
        validate_bbox(obj.get("bbox"), f"object {object_id} bbox")
        for detail in obj.get("details", []):
            if "value" in detail:
                raise HTTPException(status_code=400, detail="Detail must not contain value")
            detail_id = detail.get("detail_id")
            if not detail_id:
                raise HTTPException(status_code=400, detail="Detail detail_id is required")
            detail_to_object[detail_id] = object_id
            validate_bbox(detail.get("bbox"), f"detail {detail_id} bbox")

    for question in payload.get("questions", []):
        qtype = question.get("question_type")
        q_objects = question.get("object_ids") or []
        q_details = question.get("detail_ids") or []
        if qtype == "detection" and not q_objects:
            raise HTTPException(status_code=400, detail="Detection question requires at least one object")
        if qtype == "binding":
            if not q_objects or not q_details:
                raise HTTPException(status_code=400, detail="Binding question requires object and detail")
            for detail_id in q_details:
                if detail_to_object.get(detail_id) not in q_objects:
                    raise HTTPException(status_code=400, detail="Binding detail must belong to selected object")
        if qtype == "complex" and not question.get("task_category"):
            raise HTTPException(status_code=400, detail="Complex question requires task_category")
        for object_id in q_objects:
            if object_id not in object_ids:
                raise HTTPException(status_code=400, detail=f"Unknown object_id in question: {object_id}")
        for detail_id in q_details:
            if detail_id not in detail_to_object:
                raise HTTPException(status_code=400, detail=f"Unknown detail_id in question: {detail_id}")
        for index, bbox in enumerate(question.get("evidence_bboxes") or []):
            validate_bbox(bbox, f"question {question.get('question_id')} evidence_bboxes[{index}]")
