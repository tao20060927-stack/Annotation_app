import type { RESIZE_EDGES } from "./constants";

export type BBox = [number, number, number, number];
export type ResizeEdge = typeof RESIZE_EDGES[number];
export type ImageItem = { image_id: string; filename: string; image_path: string; annotation_status?: "in_progress" | "complete" };
export type Detail = { detail_id: string; type: string; description: string; bbox: BBox };
export type ObjectAnnotation = { object_id: string; description: string; bbox: BBox; details: Detail[] };
export type BBoxTarget = { kind: "object" | "detail"; objectId: string; detailId?: string };
export type ResizeDrag = BBoxTarget & { edge: ResizeEdge; original: BBox };
export type BoxMoveDrag = BBoxTarget & { start: { x: number; y: number }; original: BBox };
export type PanDrag = { x: number; y: number; scrollLeft: number; scrollTop: number };
export type QuestionTarget = { object_id: string; detail_ids: string[] };
export type Question = {
  question_id: string;
  question_type: "detection" | "binding" | "complex";
  task_category: string | string[] | null;
  question: string;
  answer: string;
  object_ids: string[];
  detail_ids: string[];
  evidence_bboxes: BBox[];
};
export type Annotation = {
  image_id: string;
  image_path: string;
  source_dataset: string | null;
  split: string | null;
  source_image_id: string | null;
  annotation_status: "in_progress" | "complete";
  width: number;
  height: number;
  objects: ObjectAnnotation[];
  questions: Question[];
};
