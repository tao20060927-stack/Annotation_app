import { API_BASE } from "./constants";
import type { Annotation } from "./types";

export async function fetchImages() {
  const res = await fetch(`${API_BASE}/api/images`);
  return res.json();
}

export async function fetchAnnotation(imageId: string): Promise<Annotation> {
  const res = await fetch(`${API_BASE}/api/annotations/${imageId}`);
  return res.json();
}

export async function saveAnnotationPayload(annotation: Annotation) {
  return fetch(`${API_BASE}/api/annotations/${annotation.image_id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(annotation)
  });
}

export async function exportAnnotations() {
  const res = await fetch(`${API_BASE}/api/export`, { method: "POST" });
  return res.json();
}

export async function importDraftJsonl(path: string) {
  const res = await fetch(`${API_BASE}/api/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path })
  });
  const data = await res.json();
  return { ok: res.ok, data };
}
