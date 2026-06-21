from __future__ import annotations

from pathlib import Path


APP_ROOT = Path(__file__).resolve().parents[1]
DATA_DIR = APP_ROOT / "data"
EXPORT_DIR = APP_ROOT / "exports"
DB_PATH = DATA_DIR / "annotation_state.sqlite"
