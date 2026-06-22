import React from "react";
import ReactDOM from "react-dom/client";
import { Plus, Save, Download, Trash2, MousePointer2, BoxSelect, Maximize2, Search, Move } from "lucide-react";
import { exportAnnotations, fetchAnnotation, fetchImages, importDraftJsonl, saveAnnotationPayload } from "./api";
import { boxLabel, clamp, nextId, normalizeBox, pointInBox } from "./bbox";
import { DETAIL_TYPES, RESIZE_EDGES, TASK_CATEGORIES } from "./constants";
import type { Annotation, BBox, BBoxTarget, BoxMoveDrag, Detail, ImageItem, ObjectAnnotation, PanDrag, Question, QuestionTarget, ResizeDrag, ResizeEdge } from "./types";
import "./styles.css";

function App() {
  const [images, setImages] = React.useState<ImageItem[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [imageFilter, setImageFilter] = React.useState<"in_progress" | "complete">("in_progress");
  const [annotation, setAnnotation] = React.useState<Annotation | null>(null);
  const [selectedObjectId, setSelectedObjectId] = React.useState<string>("");
  const [selectedDetailId, setSelectedDetailId] = React.useState<string>("");
  const [drawMode, setDrawMode] = React.useState<"select" | "object" | "detail" | "resize" | "zoom" | "pan">("select");
  const [draftBox, setDraftBox] = React.useState<BBox | null>(null);
  const [dragStart, setDragStart] = React.useState<{ x: number; y: number } | null>(null);
  const [resizeDrag, setResizeDrag] = React.useState<ResizeDrag | null>(null);
  const [boxMoveDrag, setBoxMoveDrag] = React.useState<BoxMoveDrag | null>(null);
  const [panDrag, setPanDrag] = React.useState<PanDrag | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [baseImageSize, setBaseImageSize] = React.useState<{ width: number; height: number } | null>(null);
  const [message, setMessage] = React.useState("");
  const [importPath, setImportPath] = React.useState("");
  const [questionDraft, setQuestionDraft] = React.useState({
    question_type: "detection" as Question["question_type"],
    task_category: [""],
    question: "",
    answer: "",
    targets: [{ object_id: "", detail_ids: [""] }] as QuestionTarget[]
  });
  const imageRef = React.useRef<HTMLImageElement | null>(null);
  const stageRef = React.useRef<HTMLDivElement | null>(null);
  const lastSavedAnnotationRef = React.useRef("");

  const filteredImages = React.useMemo(() => images.filter((image) => (image.annotation_status ?? "in_progress") === imageFilter), [images, imageFilter]);
  const currentImage = filteredImages[currentIndex];
  const selectedObject = annotation?.objects.find((obj) => obj.object_id === selectedObjectId) ?? null;
  const selectedDetails = selectedObject?.details ?? [];

  React.useEffect(() => {
    setCurrentIndex(0);
  }, [imageFilter]);

  React.useEffect(() => {
    if (currentIndex >= filteredImages.length) {
      setCurrentIndex(Math.max(0, filteredImages.length - 1));
    }
  }, [currentIndex, filteredImages.length]);

  React.useEffect(() => {
    fetchImages().then((data) => setImages(data.images ?? []));
  }, []);

  async function loadImages(nextIndex = 0) {
    const data = await fetchImages();
    setImages(data.images ?? []);
    setCurrentIndex(nextIndex);
  }

  React.useEffect(() => {
    setAnnotation(null);
    setDragStart(null);
    setDraftBox(null);
    setResizeDrag(null);
    setBoxMoveDrag(null);
    setPanDrag(null);
    setZoom(1);
    setBaseImageSize(null);
    if (!currentImage) return;
    fetchAnnotation(currentImage.image_id)
      .then((data) => {
        setAnnotation(data);
        lastSavedAnnotationRef.current = JSON.stringify(data);
        setSelectedObjectId(data.objects?.[0]?.object_id ?? "");
        setSelectedDetailId("");
        setDrawMode("select");
      });
  }, [currentImage]);

  React.useEffect(() => {
    if (!annotation) return;
    if (dragStart || resizeDrag || boxMoveDrag || panDrag) return;
    const serialized = JSON.stringify(annotation);
    if (serialized === lastSavedAnnotationRef.current) return;
    const timer = window.setTimeout(async () => {
      const res = await saveAnnotationPayload(annotation);
      if (!res.ok) {
        setMessage((await res.json()).detail ?? "自动保存失败");
        return;
      }
      lastSavedAnnotationRef.current = serialized;
      setImages((items) =>
        items.map((item) =>
          item.image_id === annotation.image_id && item.annotation_status !== annotation.annotation_status
            ? { ...item, annotation_status: annotation.annotation_status }
            : item
        )
      );
    }, 10);
    return () => window.clearTimeout(timer);
  }, [annotation, dragStart, resizeDrag, boxMoveDrag, panDrag]);

  function imagePoint(event: React.MouseEvent<HTMLElement>) {
    const img = imageRef.current;
    if (!img || !annotation || !annotation.width || !annotation.height) return null;
    const rect = img.getBoundingClientRect();
    const scaleX = annotation.width / rect.width;
    const scaleY = annotation.height / rect.height;
    return {
      x: Math.max(0, Math.min(annotation.width, (event.clientX - rect.left) * scaleX)),
      y: Math.max(0, Math.min(annotation.height, (event.clientY - rect.top) * scaleY))
    };
  }

  function scaledStyle(bbox: BBox): React.CSSProperties {
    if (!annotation || !annotation.width || !annotation.height) return {};
    return {
      left: `${(bbox[0] / annotation.width) * 100}%`,
      top: `${(bbox[1] / annotation.height) * 100}%`,
      width: `${((bbox[2] - bbox[0]) / annotation.width) * 100}%`,
      height: `${((bbox[3] - bbox[1]) / annotation.height) * 100}%`
    };
  }

  function updateBaseImageSize(img: HTMLImageElement) {
    const stage = stageRef.current;
    const maxWidth = Math.max(160, (stage?.clientWidth ?? img.naturalWidth) - 32);
    const maxHeight = Math.max(160, window.innerHeight - 128);
    const scale = Math.min(1, maxWidth / img.naturalWidth, maxHeight / img.naturalHeight);
    setBaseImageSize({ width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) });
  }

  function imageDisplayStyle(): React.CSSProperties {
    if (!baseImageSize) return {};
    return {
      width: `${Math.round(baseImageSize.width * zoom)}px`,
      height: `${Math.round(baseImageSize.height * zoom)}px`
    };
  }

  function onImageLoad(event: React.SyntheticEvent<HTMLImageElement>) {
    const img = event.currentTarget;
    updateBaseImageSize(img);
    if (!annotation || (annotation.width && annotation.height)) return;
    setAnnotation({ ...annotation, width: img.naturalWidth, height: img.naturalHeight });
  }

  function resizeBox(original: BBox, edge: ResizeEdge, point: { x: number; y: number }): BBox {
    if (!annotation) return original;
    const minSize = 4;
    let [x1, y1, x2, y2] = original;
    if (edge.includes("w")) x1 = clamp(Math.round(point.x), 0, x2 - minSize);
    if (edge.includes("e")) x2 = clamp(Math.round(point.x), x1 + minSize, annotation.width);
    if (edge.includes("n")) y1 = clamp(Math.round(point.y), 0, y2 - minSize);
    if (edge.includes("s")) y2 = clamp(Math.round(point.y), y1 + minSize, annotation.height);
    return [x1, y1, x2, y2];
  }

  function moveBox(original: BBox, start: { x: number; y: number }, point: { x: number; y: number }): BBox {
    if (!annotation) return original;
    const width = original[2] - original[0];
    const height = original[3] - original[1];
    const x1 = clamp(Math.round(original[0] + point.x - start.x), 0, annotation.width - width);
    const y1 = clamp(Math.round(original[1] + point.y - start.y), 0, annotation.height - height);
    return [x1, y1, x1 + width, y1 + height];
  }

  function applyResizedBox(target: BBoxTarget, bbox: BBox) {
    if (!annotation) return;
    if (target.kind === "object") {
      setAnnotation({ ...annotation, objects: annotation.objects.map((obj) => (obj.object_id === target.objectId ? { ...obj, bbox } : obj)) });
      return;
    }
    setAnnotation({
      ...annotation,
      objects: annotation.objects.map((obj) =>
        obj.object_id === target.objectId
          ? { ...obj, details: obj.details.map((detail) => (detail.detail_id === target.detailId ? { ...detail, bbox } : detail)) }
          : obj
      )
    });
  }

  function startResize(event: React.MouseEvent<HTMLElement>, target: Omit<ResizeDrag, "original">, original: BBox) {
    event.preventDefault();
    event.stopPropagation();
    setResizeDrag({ ...target, original });
  }

  function startBoxMove(event: React.MouseEvent<HTMLElement>, target: BBoxTarget, original: BBox) {
    if (drawMode !== "resize" || event.button !== 0) {
      event.stopPropagation();
      return;
    }
    const point = imagePoint(event);
    if (!point) return;
    event.preventDefault();
    event.stopPropagation();
    setBoxMoveDrag({ ...target, start: point, original });
  }

  function changeZoom(event: React.MouseEvent<HTMLDivElement>) {
    if (drawMode !== "zoom") return false;
    event.preventDefault();
    const delta = event.button === 2 ? -0.25 : 0.25;
    const nextZoom = clamp(Number((zoom + delta).toFixed(2)), 0.5, 4);
    setZoom(nextZoom);
    setMessage(`缩放 ${Math.round(nextZoom * 100)}%`);
    return true;
  }

  function startPan(event: React.MouseEvent<HTMLDivElement>) {
    if (drawMode !== "pan") return false;
    const stage = stageRef.current;
    if (!stage || event.button !== 0) return true;
    event.preventDefault();
    setPanDrag({ x: event.clientX, y: event.clientY, scrollLeft: stage.scrollLeft, scrollTop: stage.scrollTop });
    return true;
  }

  function clearSelectionOutsideBox(event: React.MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    if (target.closest(".bbox") || target.closest(".resize-handle")) return;
    const point = imagePoint(event);
    const selectedDetail = selectedObject?.details.find((detail) => detail.detail_id === selectedDetailId);
    const selectedBox = selectedDetail?.bbox ?? selectedObject?.bbox;
    if (point && selectedBox && pointInBox(point, selectedBox)) return;
    setSelectedObjectId("");
    setSelectedDetailId("");
  }

  function onMouseDown(event: React.MouseEvent<HTMLDivElement>) {
    clearSelectionOutsideBox(event);
    if (startPan(event)) return;
    if (changeZoom(event)) return;
    if (drawMode === "select" || drawMode === "resize") return;
    if (drawMode === "detail" && !selectedObject) {
      setMessage("先选择或新增 Object，再添加 Detail。");
      return;
    }
    const point = imagePoint(event);
    if (!point) {
      setMessage("图片尺寸尚未加载完成。");
      return;
    }
    setDragStart(point);
    setDraftBox([point.x, point.y, point.x, point.y]);
  }

  function onMouseMove(event: React.MouseEvent<HTMLDivElement>) {
    if (panDrag) {
      const stage = stageRef.current;
      if (!stage) return;
      stage.scrollLeft = panDrag.scrollLeft - (event.clientX - panDrag.x);
      stage.scrollTop = panDrag.scrollTop - (event.clientY - panDrag.y);
      return;
    }
    if (resizeDrag) {
      const point = imagePoint(event);
      if (!point) return;
      applyResizedBox(resizeDrag, resizeBox(resizeDrag.original, resizeDrag.edge, point));
      return;
    }
    if (boxMoveDrag) {
      const point = imagePoint(event);
      if (!point) return;
      applyResizedBox(boxMoveDrag, moveBox(boxMoveDrag.original, boxMoveDrag.start, point));
      return;
    }
    if (!dragStart) return;
    const point = imagePoint(event);
    if (!point) return;
    setDraftBox(normalizeBox(dragStart.x, dragStart.y, point.x, point.y));
  }

  function onMouseUp(event: React.MouseEvent<HTMLDivElement>) {
    if (panDrag) {
      setPanDrag(null);
      return;
    }
    if (resizeDrag) {
      setResizeDrag(null);
      return;
    }
    if (boxMoveDrag) {
      setBoxMoveDrag(null);
      return;
    }
    if (!annotation || !dragStart || !draftBox) return;
    const point = imagePoint(event);
    if (!point) return;
    const bbox = normalizeBox(dragStart.x, dragStart.y, point.x, point.y);
    setDragStart(null);
    setDraftBox(null);
    if (bbox[2] - bbox[0] < 4 || bbox[3] - bbox[1] < 4) return;

    if (drawMode === "object") {
      const objectId = nextId("obj", annotation.objects.map((obj) => obj.object_id));
      const obj: ObjectAnnotation = { object_id: objectId, description: "", bbox, details: [] };
      setAnnotation({ ...annotation, objects: [...annotation.objects, obj] });
      setSelectedObjectId(objectId);
      setMessage(`已新增 Object ${objectId}`);
    } else if (drawMode === "detail" && selectedObject) {
      const detailId = nextId("det", selectedObject.details.map((detail) => detail.detail_id));
      const detail: Detail = { detail_id: detailId, type: "text", description: "", bbox };
      setAnnotation({
        ...annotation,
        objects: annotation.objects.map((obj) => (obj.object_id === selectedObject.object_id ? { ...obj, details: [...obj.details, detail] } : obj))
      });
      setSelectedDetailId(detailId);
      setMessage(`已新增 Detail ${detailId}`);
    }
  }

  function updateObject(objectId: string, patch: Partial<ObjectAnnotation>) {
    if (!annotation) return;
    setAnnotation({ ...annotation, objects: annotation.objects.map((obj) => (obj.object_id === objectId ? { ...obj, ...patch } : obj)) });
  }

  function updateDetail(objectId: string, detailId: string, patch: Partial<Detail>) {
    if (!annotation) return;
    setAnnotation({
      ...annotation,
      objects: annotation.objects.map((obj) =>
        obj.object_id === objectId ? { ...obj, details: obj.details.map((detail) => (detail.detail_id === detailId ? { ...detail, ...patch } : detail)) } : obj
      )
    });
  }

  function deleteObject(objectId: string) {
    if (!annotation) return;
    setAnnotation({
      ...annotation,
      objects: annotation.objects.filter((obj) => obj.object_id !== objectId),
      questions: annotation.questions.filter((question) => !question.object_ids.includes(objectId))
    });
    setSelectedObjectId("");
    setSelectedDetailId("");
  }

  function deleteDetail(objectId: string, detailId: string) {
    if (!annotation) return;
    setAnnotation({
      ...annotation,
      objects: annotation.objects.map((obj) => (obj.object_id === objectId ? { ...obj, details: obj.details.filter((detail) => detail.detail_id !== detailId) } : obj)),
      questions: annotation.questions.filter((question) => !question.detail_ids.includes(detailId))
    });
    setSelectedDetailId("");
  }

  async function saveAnnotation() {
    if (!annotation) return;
    const res = await saveAnnotationPayload(annotation);
    if (!res.ok) {
      setMessage((await res.json()).detail ?? "保存失败");
      return;
    }
    lastSavedAnnotationRef.current = JSON.stringify(annotation);
    setImages((items) => items.map((item) => (item.image_id === annotation.image_id ? { ...item, annotation_status: annotation.annotation_status } : item)));
    setMessage("已保存");
  }

  async function exportJsonl() {
    const data = await exportAnnotations();
    setMessage(`已导出 ${data.exported} 条到 ${data.path}`);
  }

  async function importDraft() {
    if (!importPath.trim()) {
      setMessage("请填写 draft JSONL 路径。");
      return;
    }
    const { ok, data } = await importDraftJsonl(importPath.trim());
    if (!ok) {
      setMessage(data.detail ?? "导入失败");
      return;
    }
    await loadImages(0);
    setMessage(`已导入 ${data.imported} 条 draft`);
  }

  function updateQuestionTarget(index: number, patch: Partial<QuestionTarget>) {
    const targets = questionDraft.targets.map((target, targetIndex) =>
      targetIndex === index ? (patch.object_id !== undefined ? { ...target, ...patch, detail_ids: [""] } : { ...target, ...patch }) : target
    );
    if (targets.every((target) => target.object_id)) {
      targets.push({ object_id: "", detail_ids: [""] });
    }
    setQuestionDraft({ ...questionDraft, targets });
  }

  function updateQuestionTargetDetail(targetIndex: number, detailIndex: number, detailId: string) {
    const targets = questionDraft.targets.map((target, index) => {
      if (index !== targetIndex) return target;
      const detailIds = target.detail_ids.map((item, itemIndex) => (itemIndex === detailIndex ? detailId : item));
      if (detailIds.every(Boolean)) {
        detailIds.push("");
      }
      return { ...target, detail_ids: detailIds };
    });
    setQuestionDraft({ ...questionDraft, targets });
  }

  function updateQuestionTaskCategory(index: number, category: string) {
    const taskCategory = questionDraft.task_category.map((item, itemIndex) => (itemIndex === index ? category : item));
    if (taskCategory.every(Boolean)) {
      taskCategory.push("");
    }
    setQuestionDraft({ ...questionDraft, task_category: taskCategory });
  }

  function addQuestion() {
    if (!annotation) return;
    const selectedTargets = questionDraft.targets.filter((target) => target.object_id);
    const selectedObjects = selectedTargets
      .map((target) => annotation.objects.find((item) => item.object_id === target.object_id))
      .filter((item): item is ObjectAnnotation => Boolean(item));
    const includeDetails = questionDraft.question_type !== "detection";
    const selectedDetails = includeDetails
      ? selectedTargets
          .flatMap((target) => target.detail_ids.filter(Boolean).map((detail_id) => ({ object_id: target.object_id, detail_id })))
          .map((target) => {
            const obj = annotation.objects.find((item) => item.object_id === target.object_id);
            const detail = obj?.details.find((item) => item.detail_id === target.detail_id);
            return detail ? { obj, detail } : null;
          })
          .filter((item): item is { obj: ObjectAnnotation; detail: Detail } => Boolean(item))
      : [];
    if (!questionDraft.question.trim() || !questionDraft.answer.trim()) {
      setMessage("问题和答案不能为空。");
      return;
    }
    if (!selectedObjects.length) {
      setMessage("问题必须选择 Object。");
      return;
    }
    if (questionDraft.question_type === "binding" && selectedTargets.some((target) => !target.detail_ids.some(Boolean))) {
      setMessage("Binding 问题每个 Object 都必须选择其下的 Detail。");
      return;
    }
    const selectedTaskCategories = questionDraft.task_category.filter(Boolean);
    if (questionDraft.question_type === "complex" && !selectedTaskCategories.length) {
      setMessage("Complex Problem 必须至少选择一类任务分类。");
      return;
    }
    const questionId = nextId("q", annotation.questions.map((question) => question.question_id));
    const objectIds = Array.from(new Set(selectedObjects.map((obj) => obj.object_id)));
    const detailIds = selectedDetails.map((item) => item.detail.detail_id);
    const evidence: BBox[] = [...selectedObjects.map((obj) => obj.bbox), ...selectedDetails.map((item) => item.detail.bbox)];
    const question: Question = {
      question_id: questionId,
      question_type: questionDraft.question_type,
      task_category: questionDraft.question_type === "complex" ? selectedTaskCategories : null,
      question: questionDraft.question,
      answer: questionDraft.answer,
      object_ids: objectIds,
      detail_ids: detailIds,
      evidence_bboxes: evidence
    };
    setAnnotation({ ...annotation, questions: [...annotation.questions, question] });
    setQuestionDraft({ ...questionDraft, question: "", answer: "", targets: [{ object_id: "", detail_ids: [""] }] });
    setMessage(`已新增问题 ${questionId}`);
  }

  function resizeHandles(target: Omit<ResizeDrag, "edge" | "original">, bbox: BBox) {
    if (drawMode !== "resize") return null;
    return RESIZE_EDGES.map((edge) => (
      <span
        key={edge}
        className={`resize-handle ${edge}`}
        onMouseDown={(event) => startResize(event, { ...target, edge }, bbox)}
      />
    ));
  }

  if (!images.length) {
    return (
      <div className="empty">
        <p>未找到图片。请先导入 draft JSONL。</p>
        <div className="empty-import">
          <input value={importPath} placeholder="draft JSONL 路径" onChange={(event) => setImportPath(event.target.value)} />
          <button onClick={importDraft}><Download size={16} />导入</button>
        </div>
        <p>{message}</p>
      </div>
    );
  }

  if (currentImage && !annotation) {
    return <div className="empty">正在加载 {currentImage.image_id}...</div>;
  }

  return (
    <div className="app">
      <header>
        <div>
          <strong>Annotation App</strong>
          <span>{currentImage?.image_id ?? "无当前图片"}</span>
        </div>
        <div className="header-actions">
          <button disabled={!currentImage} onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}>上一张</button>
          <span>{currentImage ? currentIndex + 1 : 0} / {filteredImages.length}</span>
          <button disabled={!currentImage} onClick={() => setCurrentIndex(Math.min(filteredImages.length - 1, currentIndex + 1))}>下一张</button>
          <input className="import-path" value={importPath} placeholder="draft JSONL 路径" onChange={(event) => setImportPath(event.target.value)} />
          <button onClick={importDraft}><Download size={16} />导入</button>
          <button onClick={saveAnnotation}><Save size={16} />保存</button>
          <button onClick={exportJsonl}><Download size={16} />导出</button>
        </div>
      </header>

      <main>
        <aside className="image-list-panel">
          <div className="image-list-tabs">
            <button className={imageFilter === "in_progress" ? "active" : ""} onClick={() => setImageFilter("in_progress")}>未标注</button>
            <button className={imageFilter === "complete" ? "active" : ""} onClick={() => setImageFilter("complete")}>已标注</button>
          </div>
          <div className="image-list-count">{filteredImages.length} 张</div>
          <div className="image-list">
            {filteredImages.map((image, index) => (
              <button key={image.image_id} className={`image-list-item ${currentImage?.image_id === image.image_id ? "selected" : ""}`} onClick={() => setCurrentIndex(index)}>
                <strong>{image.image_id}</strong>
                <small>{image.filename}</small>
              </button>
            ))}
          </div>
        </aside>

        {currentImage && annotation ? (
        <section className="canvas-panel">
          <div className="toolbar">
            <button className={drawMode === "select" ? "active" : ""} onClick={() => setDrawMode("select")}><MousePointer2 size={16} />选择</button>
            <button className={drawMode === "object" ? "active" : ""} onClick={() => setDrawMode("object")}><BoxSelect size={16} />Object 红框</button>
            <button className={drawMode === "detail" ? "active" : ""} onClick={() => setDrawMode("detail")}><BoxSelect size={16} />Detail 黄框</button>
            <button className={drawMode === "resize" ? "active" : ""} onClick={() => setDrawMode("resize")}><Maximize2 size={16} />调整大小和拖动</button>
            <button className={drawMode === "zoom" ? "active" : ""} onClick={() => setDrawMode("zoom")}><Search size={16} />缩放 {Math.round(zoom * 100)}%</button>
            <button className={drawMode === "pan" ? "active" : ""} onClick={() => setDrawMode("pan")}><Move size={16} />拖动</button>
            <span>{message}</span>
          </div>
          <div className="image-stage" ref={stageRef}>
            <div
              className={`image-frame ${drawMode === "object" || drawMode === "detail" ? "drawing" : ""} ${drawMode === "resize" ? "resizing" : ""} ${drawMode === "zoom" ? "zooming" : ""} ${drawMode === "pan" ? "panning" : ""} ${panDrag ? "dragging" : ""}`}
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={() => { setPanDrag(null); setBoxMoveDrag(null); }}
              onContextMenu={(event) => {
                if (drawMode === "zoom") event.preventDefault();
              }}
            >
              <img key={currentImage.image_id} ref={imageRef} style={imageDisplayStyle()} onLoad={onImageLoad} src={`/api/images/${currentImage.image_id}/file`} draggable={false} />
              {annotation.objects.map((obj) => (
                <React.Fragment key={obj.object_id}>
                  <button className={`bbox object ${selectedObjectId === obj.object_id && !selectedDetailId ? "selected" : ""}`} style={scaledStyle(obj.bbox)} onMouseDown={(event) => { setSelectedObjectId(obj.object_id); setSelectedDetailId(""); startBoxMove(event, { kind: "object", objectId: obj.object_id }, obj.bbox); }} onClick={(event) => { event.stopPropagation(); setSelectedObjectId(obj.object_id); setSelectedDetailId(""); }}>
                    {obj.object_id}
                    {selectedObjectId === obj.object_id && !selectedDetailId && resizeHandles({ kind: "object", objectId: obj.object_id }, obj.bbox)}
                  </button>
                  {obj.details.map((detail) => (
                    <button key={detail.detail_id} className={`bbox detail ${selectedObjectId === obj.object_id && selectedDetailId === detail.detail_id ? "selected" : ""}`} style={scaledStyle(detail.bbox)} onMouseDown={(event) => { setSelectedObjectId(obj.object_id); setSelectedDetailId(detail.detail_id); startBoxMove(event, { kind: "detail", objectId: obj.object_id, detailId: detail.detail_id }, detail.bbox); }} onClick={(event) => { event.stopPropagation(); setSelectedObjectId(obj.object_id); setSelectedDetailId(detail.detail_id); }}>
                      {detail.detail_id}
                      {selectedObjectId === obj.object_id && selectedDetailId === detail.detail_id && resizeHandles({ kind: "detail", objectId: obj.object_id, detailId: detail.detail_id }, detail.bbox)}
                    </button>
                  ))}
                </React.Fragment>
              ))}
              {draftBox && <div className={`bbox draft ${drawMode}`} style={scaledStyle(draftBox)} />}
            </div>
          </div>
        </section>
        ) : (
          <section className="canvas-panel empty-filter">
            当前筛选没有图片。
          </section>
        )}

        {annotation ? (
        <aside className="side-panel">
          <section>
            <h2>Meta</h2>
            <small>source_dataset: {annotation.source_dataset ?? ""}</small>
            <small>split: {annotation.split ?? ""}</small>
            <small>source_image_id: {annotation.source_image_id ?? ""}</small>
          </section>

          <section>
            <div className="section-title"><h2>Object</h2><button onClick={() => setDrawMode("object")}><Plus size={15} />新增</button></div>
            <div className="list">
              {annotation.objects.map((obj) => (
                <div key={obj.object_id} className={`item ${selectedObjectId === obj.object_id ? "selected" : ""}`} onClick={() => { setSelectedObjectId(obj.object_id); setSelectedDetailId(""); }}>
                  <div className="item-head"><strong>{obj.object_id}</strong><button onClick={(event) => { event.stopPropagation(); deleteObject(obj.object_id); }}><Trash2 size={14} /></button></div>
                  <textarea value={obj.description} placeholder="Object 描述" onChange={(event) => updateObject(obj.object_id, { description: event.target.value })} />
                  <small>{boxLabel(obj.bbox)}</small>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="section-title"><h2>Detail</h2><button disabled={!selectedObject} onClick={() => setDrawMode("detail")}><Plus size={15} />新增</button></div>
            {!selectedObject && <p className="hint">先选择 Object。</p>}
            {selectedDetails.map((detail) => (
              <div key={detail.detail_id} className={`item ${selectedDetailId === detail.detail_id ? "selected" : ""}`} onClick={() => setSelectedDetailId(detail.detail_id)}>
                <div className="item-head"><strong>{detail.detail_id}</strong><button onClick={(event) => { event.stopPropagation(); deleteDetail(selectedObjectId, detail.detail_id); }}><Trash2 size={14} /></button></div>
                <select value={detail.type} onChange={(event) => updateDetail(selectedObjectId, detail.detail_id, { type: event.target.value })}>
                  {DETAIL_TYPES.map((type) => <option key={type}>{type}</option>)}
                </select>
                <textarea value={detail.description} placeholder="Detail 描述" onChange={(event) => updateDetail(selectedObjectId, detail.detail_id, { description: event.target.value })} />
                <small>{boxLabel(detail.bbox)}</small>
              </div>
            ))}
          </section>

          <section>
            <h2>Question</h2>
            <div className="question-type-group">
              <select value={questionDraft.question_type} onChange={(event) => setQuestionDraft({ ...questionDraft, question_type: event.target.value as Question["question_type"] })}>
                <option value="detection">detection</option>
                <option value="binding">binding</option>
                <option value="complex">complex</option>
              </select>
              {questionDraft.question_type === "complex" && (
                questionDraft.task_category.map((categoryValue, index) => (
                  <select key={index} value={categoryValue} onChange={(event) => updateQuestionTaskCategory(index, event.target.value)}>
                    <option value="">选择任务分类</option>
                    {TASK_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
                  </select>
                ))
              )}
            </div>
            <div className="question-targets">
              {questionDraft.targets.map((target, index) => (
                <div key={index} className="question-target-row">
                  <select value={target.object_id} onChange={(event) => updateQuestionTarget(index, { object_id: event.target.value })}>
                    <option value="">选择 Object</option>
                    {annotation.objects.map((obj) => <option key={obj.object_id} value={obj.object_id}>{obj.object_id}</option>)}
                  </select>
                  {target.detail_ids.map((detailId, detailIndex) => (
                    <select key={detailIndex} value={detailId} onChange={(event) => updateQuestionTargetDetail(index, detailIndex, event.target.value)}>
                      <option value="">选择 Detail</option>
                      {annotation.objects.find((obj) => obj.object_id === target.object_id)?.details.map((detail) => <option key={detail.detail_id} value={detail.detail_id}>{detail.detail_id}</option>)}
                    </select>
                  ))}
                </div>
              ))}
            </div>
            <textarea value={questionDraft.question} placeholder="问题" onChange={(event) => setQuestionDraft({ ...questionDraft, question: event.target.value })} />
            <input value={questionDraft.answer} placeholder="答案" onChange={(event) => setQuestionDraft({ ...questionDraft, answer: event.target.value })} />
            <button onClick={addQuestion}><Plus size={15} />新增问题</button>
            <div className="list">
              {annotation.questions.map((question) => (
                <div key={question.question_id} className="item">
                  <strong>{question.question_id} · {question.question_type}</strong>
                  <p>{question.question}</p>
                  <small>{question.answer}</small>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2>标注是否完成</h2>
            <select value={annotation.annotation_status} onChange={(event) => setAnnotation({ ...annotation, annotation_status: event.target.value as Annotation["annotation_status"] })}>
              <option value="in_progress">未完成</option>
              <option value="complete">已完成</option>
            </select>
          </section>
        </aside>
        ) : (
          <aside className="side-panel">
            <section>
              <h2>Meta</h2>
              <p className="hint">当前筛选没有图片。</p>
            </section>
          </aside>
        )}
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
