from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


APP_ROOT = Path(__file__).resolve().parents[1]
BENCHMARK_ROOT = APP_ROOT.parent
DEFAULT_METADATA = BENCHMARK_ROOT / "第二次实验" / "stage1" / "metadata" / "candidate_images_stage1.jsonl"
DEFAULT_IMAGES_DIR = BENCHMARK_ROOT / "第二次实验" / "stage1" / "images"
DEFAULT_OUTPUT = APP_ROOT / "drafts" / "stage1_draft.jsonl"


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    with path.open("r", encoding="utf-8-sig") as f:
        for line_no, line in enumerate(f, start=1):
            if not line.strip():
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as exc:
                raise ValueError(f"Invalid JSONL at line {line_no}: {path}") from exc
    return rows


def build_draft_rows(metadata_path: Path, images_dir: Path, split: str) -> list[dict[str, Any]]:
    image_files = {path.name for path in images_dir.iterdir() if path.is_file()}
    rows: list[dict[str, Any]] = []
    for item in read_jsonl(metadata_path):
        image_path = str(item.get("image_path") or "")
        image_name = Path(image_path).name
        if image_name not in image_files:
            continue
        rows.append(
            {
                "source_dataset": item.get("source_dataset"),
                "split": split,
                "image_id": item.get("image_id"),
                "source_image_id": str(item.get("source_image_id")),
                "image_path": image_path,
                "width": int(item.get("width") or 0),
                "height": int(item.get("height") or 0),
                "annotation_status": "in_progress",
                "objects": [],
                "questions": [],
            }
        )
    return rows


def write_jsonl(rows: list[dict[str, Any]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8-sig", newline="\n") as f:
        for row in rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Build Annotation_app draft JSONL from stage1 metadata.")
    parser.add_argument("--metadata", default=str(DEFAULT_METADATA))
    parser.add_argument("--images-dir", default=str(DEFAULT_IMAGES_DIR))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    parser.add_argument("--split", default="stage1")
    args = parser.parse_args()

    rows = build_draft_rows(Path(args.metadata), Path(args.images_dir), args.split)
    write_jsonl(rows, Path(args.output))
    print(f"wrote {len(rows)} rows to {Path(args.output)}")


if __name__ == "__main__":
    main()
