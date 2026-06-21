import type { BBox } from "./types";

export function nextId(prefix: string, existing: string[]) {
  let value = existing.length + 1;
  while (existing.includes(`${prefix}_${String(value).padStart(3, "0")}`)) value += 1;
  return `${prefix}_${String(value).padStart(3, "0")}`;
}

export function normalizeBox(startX: number, startY: number, endX: number, endY: number): BBox {
  return [Math.round(Math.min(startX, endX)), Math.round(Math.min(startY, endY)), Math.round(Math.max(startX, endX)), Math.round(Math.max(startY, endY))];
}

export function boxLabel(bbox: BBox) {
  return `[${bbox.join(", ")}]`;
}

export function pointInBox(point: { x: number; y: number }, bbox: BBox) {
  return point.x >= bbox[0] && point.x <= bbox[2] && point.y >= bbox[1] && point.y <= bbox[3];
}

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
