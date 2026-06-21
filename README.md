# Annotation App

本地一体化标注工具：React/Vite 前端 + FastAPI 后端 + SQLite 保存 + JSONL 导出。

## 首次准备

```powershell
cd C:\Users\tao20\Desktop\Benchmark\Annotation_app\frontend
npm install
```

## 启动后端

打开一个 PowerShell：

```powershell
cd C:\Users\tao20\Desktop\Benchmark\Annotation_app
python -m uvicorn backend.app:app --reload --host 127.0.0.1 --port 8000
```

不设置默认图片目录。启动后需要导入 draft JSONL，图片列表只来自 draft JSONL 中登记的样本。

## 启动前端

再打开另一个 PowerShell：

```powershell
cd C:\Users\tao20\Desktop\Benchmark\Annotation_app\frontend
npm run dev
```

访问：

```text
http://127.0.0.1:5173
```

## Draft JSONL 导入

一个数据集先准备 draft JSONL，每行一张图，至少包含：

```json
{"source_dataset":"COCO","split":"train","image_id":"img_000001","source_image_id":"491701","image_path":"images/img_000001.jpg"}
```

字段说明：

- `source_dataset`：数据集来源，会保留到最终导出。
- `split`：数据集划分，会保留到最终导出。
- `image_id`：标注项目内部使用的图片 ID。
- `source_image_id`：原始数据集图片 ID。
- `image_path`：图片路径；可以是绝对路径，也可以是相对路径。

在页面顶部的 `draft JSONL 路径` 输入框填入本地 JSONL 路径，然后点击 `导入`。

也可以用 API 导入：

```powershell
Invoke-RestMethod -Method Post -Uri http://127.0.0.1:8000/api/import -ContentType "application/json" -Body '{"path":"C:\path\to\draft.jsonl"}'
```

导入后，App 会在 draft 行上继续填写 Object、Detail、Question 和 `annotation_status`。

## 停止服务

在对应 PowerShell 窗口按 `Ctrl+C`。

如果端口被占用，可以强制停止：

```powershell
netstat -ano | findstr :8000
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

## 数据

- SQLite 状态：`data/annotation_state.sqlite`
- JSONL 导出：`exports/annotations.jsonl`
- 标注状态字段：`annotation_status`，取值为 `in_progress` 或 `complete`
