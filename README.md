# Photo Rater

一款桌面端照片评分与筛选工具。导入照片文件夹，自动评分排序，人工标记保留/淘汰，导出精选集。全本地运行，隐私友好。

![Photo Rater 截图](./public/screenshoot.png)

> 当前版本：**v0.2.0** — [GitHub Releases 下载](https://github.com/printfCYQ/photo-rater/releases/latest)

## 核心功能

- **文件夹导入** — 选择本地文件夹，递归扫描 jpg/png/webp/bmp/tiff 等格式，按文件夹创建相册管理
- **iPhone / HEIC 支持** — iOS 照片（HEIC/HEIF）可正常生成缩略图与大图，不再空白
- **相似 / 连拍去重** — 自动把相似的连拍、重复照片聚成一组，每组按评分排序，方便挑出最好的一张
- **时间 / 地点分组** — 侧边栏可按 年/月/日 浏览；带定位的照片可按拍摄地点筛选（无 GPS 归入「未知地点」）
- **后台导入** — 大相册改为后台扫描，状态栏实时显示进度，导入过程中仍可浏览其它相册
- **自动评分** — NIMA AI 美学模型 (ONNX) + 六维启发式分析（清晰度、色彩、构图、曝光、频域、噪点），混合加权得出 0-10 综合分
- **人工筛选** — 1-5 星评分 + 保留/淘汰标记，键盘快捷键全流程操作
- **筛选排序** — 按综合分/AI分/清晰度/评分排序，按状态和最低分阈值过滤
- **大图查看** — Lightbox 全屏查看，支持缩放平移、键盘导航、实时评分
- **导出精选** — 将标记为「保留」的照片批量复制到目标文件夹
- **可调权重** — 评分维度权重和 AI 混合比例可在设置中实时调整，四项主权重自动归一化
- **个性化** — 6 套主题色、3 档字体大小，设置本地持久化

## 评分系统

### 综合分计算

```
# 启发式分（四维加权，自动归一化）
heuristic = sharpness × w_sharp + exposure × w_exposure + color × w_color + composition × w_composition

# 噪点惩罚倍率
noise_factor = 1.0 - noise_level × noise_penalty

# 最终综合分
composite = (ai_norm × ai_weight + heuristic × (1 - ai_weight)) × noise_factor × 10
```

- **无 AI 模型时**：`composite = heuristic × noise_factor × 10`（纯启发式）
- **有 AI 模型时**：按 `ai_weight` 混合 AI 分和启发式分，默认各 50%
- 权重全部可在设置面板中调整，修改后重新评分即生效

### 六维启发式信号

| 信号 | 技术 | 说明 |
|------|------|------|
| 清晰度 | Laplacian 方差 + FFT 频域分析 | 双指标融合，区分锐度与高频细节 |
| 色彩和谐 | 饱和度分布 + 色相多样性 | 灰蒙蒙的照片得分低 |
| 构图 | Sobel 边缘 + 三分法对齐 | 兴趣点靠近九宫格交叉点得分高 |
| 曝光 | 亮度偏离中间值检测 | 过曝/欠曝自动扣分 |
| 噪点 | 平坦区域局部方差 | 高噪点照片综合分按倍率惩罚 |
| 频域 | 多尺度梯度比率 | 补充 Laplacian，更鲁棒的清晰度评估 |

### NIMA AI 模型

- 使用 NIMA MobileNet ONNX 模型（约 12MB），随 App 打包分发
- 输入 224×224 NHWC，归一化到 [-1, 1]
- 输出 10 类 logits → softmax → 期望值（1-10 分）
- 推理使用 `ort` crate (ONNX Runtime)，rayon 并行预处理

## 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 框架 | Tauri v2 | 跨平台，Rust 后端，安装包小 |
| 前端 | React 19 + TypeScript + Vite 7 | 虚拟列表网格，流畅交互 |
| 样式 | Tailwind CSS v3 | 设计令牌系统，CSS 变量动态主题 |
| 后端 | Rust | 图片处理、ML 推理、文件 IO |
| 图片处理 | image 0.25 | 解码、缩放、缩略图缓存 |
| ML 推理 | ort 2.0.0-rc.13 + ndarray 0.17 | ONNX Runtime 端侧推理 |
| 存储 | rusqlite (SQLite) | 本地评分数据，自动迁移 |
| 虚拟列表 | react-virtuoso | 数千张缩略图流畅滚动 |
| 大图查看 | react-zoom-pan-pinch | Lightbox 缩放平移 |

## 项目结构

```
photo-rater/
├── src-tauri/              # Rust 后端
│   ├── src/
│   │   ├── lib.rs          # 应用入口，模块注册，NIMA 初始化
│   │   ├── commands.rs     # Tauri commands（扫描/评分/分组/导出等）
│   │   ├── scanner.rs      # 文件扫描 (walkdir + EXIF)
│   │   ├── image_proc.rs   # 图片处理 (缩略图缓存 + 启发式信号 + HEIC)
│   │   ├── scoring.rs      # 评分引擎 (综合分计算 + 权重管理)
│   │   ├── grouping.rs     # 时间/地点/相似分组
│   │   ├── nima.rs         # NIMA ONNX 推理
│   │   ├── storage.rs      # SQLite 存储层
│   │   └── models.rs       # 数据模型
│   ├── models/
│   │   └── nima_mobilenet.onnx  # NIMA 模型文件
│   └── Cargo.toml
├── src/                    # React 前端
│   ├── components/
│   │   ├── App.tsx         # 主应用
│   │   ├── Titlebar.tsx    # 自定义标题栏
│   │   ├── Sidebar.tsx     # 相册侧边栏
│   │   ├── Toolbar.tsx     # 工具栏 (排序/筛选/评分/导出)
│   │   ├── PhotoGrid.tsx   # 虚拟列表照片网格
│   │   ├── Lightbox.tsx    # 大图查看器
│   │   ├── Settings.tsx    # 设置面板
│   │   ├── StatusBar.tsx   # 底部状态栏
│   │   └── ConfirmDialog.tsx
│   ├── contexts/
│   │   └── SettingsContext.tsx  # 全局设置 (主题/字体/评分权重)
│   ├── api.ts              # Tauri API 封装
│   └── types.ts            # TypeScript 类型定义
└── package.json
```

## 开发

### 环境要求

- [Rust](https://rustup.rs/) (stable)
- Node.js 18+
- pnpm
- 系统依赖：参见 [Tauri v2 前置要求](https://v2.tauri.app/start/prerequisites/)

### 启动开发

```bash
cd photo-rater
pnpm install
pnpm tauri:dev
```

### 构建发布

```bash
pnpm tauri:build
# macOS:   src-tauri/target/release/bundle/macos/*.app     （zip 后分发，未走 dmg）
# Windows: src-tauri/target/release/bundle/msi/*.msi 与 nsis/*.exe
# Linux:   src-tauri/target/release/bundle/appimage/*.AppImage 与 deb/*.deb
```

## 下载与安装

最新版本：**v0.2.0** — [GitHub Releases](https://github.com/printfCYQ/photo-rater/releases/latest)

从 Releases 下载对应平台安装包：

- **macOS (Apple Silicon)**：`Photo.Rater_X.Y.Z_macos_aarch64.zip` → 解压得到 `Photo Rater.app`
- **Windows**：`Photo.Rater_X.Y.Z_x64-setup.exe`（或 `_x64_en-US.msi`）
- **Linux**：`.AppImage` / `.deb`（如已构建）

> Windows / Linux 安装包由 **GitHub Actions 在打 tag 时自动构建上传**；macOS 安装包需在**本地 Mac 上构建后手动上传**（GitHub 的 Linux 构建机无法产出 macOS 包），因此 macOS 包文件名带 `_macos_aarch64` 以标明平台与架构。

### macOS 打开方法

应用**未付费签名/公证**，下载解压后首次打开可能提示：

- "来自身份不明的开发者" / "无法验证开发者"，或
- **"已损坏，无法打开。你应该将它移到废纸篓"**

这两种都是 Gatekeeper 的拦截提示，**并非安装包真的损坏**。修复（在终端执行，**原样复制粘贴以下命令即可**）：

```bash
# 若解压在"下载"文件夹（注意：路径含空格，必须用英文双引号包住）
xattr -cr "/Users/mac/Downloads/Photo Rater.app"

# 若已拖入"应用程序"
sudo xattr -rd com.apple.quarantine "/Applications/Photo Rater.app"
```

> ⚠️ **注意**：`Photo Rater.app` 中间有空格，命令里**必须用双引号包住整个路径**（如上面所示），或用反斜杠转义 `Photo\ Rater.app`。如果直接写 `xattr -cr ~/Downloads/Photo Rater.app`（不加引号/转义），shell 会把 `Photo` 和 `Rater.app` 当成两个文件，报 `No such file`。

清除隔离标记后即可正常打开。如仍被拦，再执行本地重签名后右键打开：

```bash
sudo codesign --force --deep --sign - "/Applications/Photo Rater.app"
```

> 要彻底消除此提示，需加入 Apple Developer Program（$99/年）对 app 进行签名与公证。个人/内部使用按上述步骤绕过即可。

### 仅前端开发 (Mock 模式)

```bash
pnpm dev
# 浏览器访问 http://localhost:1420
# 使用 mock 数据，无需 Rust 后端
```

## Tauri Commands

| 命令 | 说明 |
|------|------|
| `scan_directory` | 扫描文件夹，创建相册，返回照片列表 |
| `list_albums` / `delete_album` | 相册管理 |
| `list_photos` | 按筛选条件查询照片（状态/分数/排序） |
| `get_time_tree` / `get_location_groups` / `get_similar_groups` | 时间树 / 地点分组 / 相似（连拍）分组 |
| `get_thumbnail` / `batch_get_thumbnails` | 缩略图生成（磁盘缓存 + Asset Protocol） |
| `get_preview_image` | 大图预览（按需缩放） |
| `score_photo_ai` / `batch_score_ai` | 单张/批量评分（AI + 启发式） |
| `rate_photo` | 保存用户评分和标记 |
| `export_selection` | 导出精选照片到目标文件夹 |
| `get_stats` | 统计数据（总数/已评/保留/淘汰） |
| `get_scoring_weights` / `set_scoring_weights` | 评分权重读写 |
| `get_nima_status` | NIMA 模型加载状态 |
| `clear_all_cache` / `get_cached_thumbnail_paths` | 缓存管理 |

## 设计原则

- **端侧优先** — 图片和模型推理全部本地完成，不上传云端
- **性能优先** — 重活（解码、推理、IO）在 Rust 侧，前端只做交互
- **AI 粗筛 + 人工精挑** — AI 不做终审，只做排序预筛，避免通用模型与个人审美偏差
- **渐进增强** — 无 AI 模型时自动回退纯启发式评分，功能完整可用

## 许可

MIT
