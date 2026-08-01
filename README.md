# Photo Rater - 照片打分筛选

一款本地优先的桌面照片打分与筛选工具。扫描文件夹导入照片，通过 AI 启发式评分 + 手动评分快速筛选，批量导出精选照片。基于 Tauri v2 + React 19 + Rust 构建。

## 功能特性

### 照片管理
- **文件夹扫描导入**：递归扫描目录下所有图片（JPG/JPEG/PNG/HEIC/HEIF/WebP/BMP/TIFF），并行读取 EXIF 元数据（拍摄时间、尺寸）
- **相册/项目管理**：按文件夹导入创建相册，侧边栏快速切换
- **SQLite 本地存储**：所有照片元数据、评分、状态持久化存储，重新打开应用即时加载

### 评分体系
- **AI 启发式评分**：Laplacian 方差检测清晰度 + 平均亮度检测曝光，加权计算综合分（0-10）
  - 权重：AI分 0.7 + 清晰度 0.2 + 曝光 0.1（AI 分尚未接入，当前仅用启发式信号）
- **手动评分**：1-5 星评分 + 保留/淘汰/待定状态标记
- **批量评分**：支持批量标记照片状态，批量 AI 评分带进度条

### 筛选与排序
- 按状态筛选（全部 / 保留 / 淘汰 / 待评分）
- 按评分范围筛选
- 多字段排序：综合分 / AI分 / 清晰度 / 用户评分 / 文件名 / 导入时间
- 底部状态栏实时显示统计数据

### 图片查看器（Lightbox）
- 基于 `react-zoom-pan-pinch` 的全功能查看器
- 鼠标滚轮缩放、拖拽平移、双击放大
- 旋转（R / Shift+R）、水平翻转（H）、垂直翻转（V）
- 缩放百分比实时显示
- 全屏模式（F）
- 缩略图导航条（T）
- 复位功能（0）—— 重置位置、缩放、旋转、翻转
- 键盘左右切换照片，预加载相邻图片
- CSS Flexbox 居中，不依赖 JS 计算位置

### 导出
- 以相册为维度，复制标记为"保留"的照片到目标目录
- 自动处理文件名冲突（追加时间戳）
- 支持复制或移动模式

### 性能优化
- **缩略图磁盘缓存**：Triangle 滤镜快速生成，JPEG 编码写入 `~/Library/Caches/com.photorater.desktop/thumbs/`，LRU 内存缓存 2000 条 + 文件 mtime 校验
- **Asset Protocol**：通过 Tauri Asset Protocol 直接加载磁盘文件，无需 base64 编码传输
- **批量缓存查询**：一次 IPC 调用返回所有磁盘缓存命中路径，消除 N 次往返（重新打开相册从 N 次 IPC → 1 次）
- **前端懒加载**：Intersection Observer 按需加载缩略图，未命中缓存才生成
- **Rayon 并行**：EXIF 读取、缩略图生成、启发式评分计算均使用 rayon 并行处理

## 技术栈

| 层 | 技术 |
|---|---|
| 桌面框架 | Tauri v2 (v2.5) |
| 前端 | React 19 + TypeScript + Vite 7 |
| 后端 | Rust (edition 2021) |
| 图片处理 | image v0.25 (Triangle 滤镜 + JPEG 编码) |
| 文件扫描 | walkdir + kamadak-exif (rayon 并行) |
| 数据库 | rusqlite (SQLite, bundled) |
| 图片查看器 | react-zoom-pan-pinch v4 |
| 异步运行时 | tokio |
| 并行计算 | rayon |

## 项目结构

```
photo-rater/
├── src-tauri/                  # Rust 后端
│   ├── Cargo.toml
│   ├── tauri.conf.json         # Tauri 配置 (窗口、权限、Asset Protocol)
│   ├── capabilities/
│   │   └── default.json        # 权限配置
│   ├── icons/                  # 应用图标
│   └── src/
│       ├── lib.rs              # 应用入口，命令注册
│       ├── commands.rs         # Tauri Commands (前端可调用)
│       ├── models.rs           # 数据模型 (Photo, Album, PhotoFilter 等)
│       ├── scanner.rs          # 文件扫描 + EXIF 读取
│       ├── image_proc.rs       # 缩略图生成 + 磁盘缓存 + 启发式信号
│       ├── storage.rs          # SQLite 存储层
│       └── scoring.rs          # 综合评分计算
│
├── src/                        # React 前端
│   ├── main.tsx                # 入口
│   ├── App.tsx                 # 主组件 (状态管理)
│   ├── api.ts                  # Tauri API 封装
│   ├── types.ts                # TypeScript 类型定义
│   ├── App.css                 # 全局样式 (深色主题)
│   ├── components/
│   │   ├── App.tsx             # 主布局 + 状态管理
│   │   ├── Sidebar.tsx         # 相册列表侧边栏
│   │   ├── Toolbar.tsx         # 工具栏 (排序/筛选/批量操作/导出)
│   │   ├── PhotoGrid.tsx       # 照片网格 (CSS Grid + 懒加载)
│   │   ├── Lightbox.tsx        # 全功能图片查看器
│   │   └── StatusBar.tsx       # 底部状态栏
│   └── mock/                   # Web 调试用 Mock 层
│       ├── mock-data.ts        # 模拟数据 (3 相册 48 张照片)
│       ├── tauri-core.ts       # mock invoke + convertFileSrc
│       ├── tauri-event.ts      # mock listen / emit
│       ├── tauri-dialog.ts     # mock open (文件选择)
│       └── tauri-window.ts     # mock getCurrentWindow (全屏)
│
├── vite.config.ts              # Vite 配置 (条件化 Mock Alias)
├── package.json
└── tsconfig.json
```

## 快速开始

### 环境要求

- [Node.js](https://nodejs.org/) 18+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- [Rust](https://www.rust-lang.org/tools/install) (stable toolchain)
- macOS: Xcode Command Line Tools (`xcode-select --install`)

### 安装

```bash
cd photo-rater
pnpm install
```

### 桌面应用开发

```bash
pnpm tauri dev
```

Tauri 会自动启动 Vite dev server 并打开桌面窗口。修改前端代码 HMR 热更新，修改 Rust 代码自动重新编译。

### Web 浏览器调试

无需 Rust 后端，在浏览器中调试前端 UI：

```bash
pnpm dev
```

打开 `http://localhost:1420`。Vite 会自动将 `@tauri-apps/api` 等模块 alias 到 `src/mock/` 下的 mock 实现，使用 Lorem Picsum 占位图模拟真实照片数据。

> 原理：`vite.config.ts` 检测 `TAURI_DEV_HOST` 环境变量判断是否 Tauri 环境。非 Tauri 时自动启用 mock alias，`tauri dev` 时走真实 API，互不干扰。

### 构建发布

```bash
pnpm tauri build
```

生成的安装包在 `src-tauri/target/release/bundle/` 下。

## Tauri Commands (后端 API)

| 命令 | 说明 |
|------|------|
| `scan_directory` | 扫描目录创建相册，返回照片列表 |
| `list_albums` | 列出所有相册 |
| `list_photos` | 按筛选条件列出照片（相册/状态/评分范围/排序） |
| `get_thumbnail` | 获取单张缩略图（磁盘缓存 + 按需生成） |
| `batch_get_thumbnails` | 批量并行生成缩略图 |
| `get_cached_thumbnail_paths` | 批量查询磁盘缓存命中路径（不生成，快速） |
| `get_preview_image` | 获取大图预览（Lightbox 用） |
| `rate_photo` | 更新照片评分和状态 |
| `score_photo_ai` | 单张 AI 启发式评分 |
| `batch_score_ai` | 批量 AI 评分（带进度事件） |
| `export_selection` | 导出精选照片到目标目录 |
| `get_stats` | 获取相册统计数据 |
| `delete_album` | 删除相册及其照片记录 |

## 键盘快捷键 (Lightbox)

| 按键 | 功能 |
|------|------|
| `←` / `→` | 上一张 / 下一张 |
| `Esc` | 关闭查看器 |
| `R` / `Shift+R` | 顺时针 / 逆时针旋转 |
| `H` / `V` | 水平翻转 / 垂直翻转 |
| `0` | 复位（位置、缩放、旋转、翻转全部重置） |
| `F` | 全屏切换 |
| `T` | 缩略图导航条切换 |
| `1`-`5` | 设置 1-5 星评分 |
| `K` / `X` | 标记保留 / 淘汰 |

## 数据存储位置

| 数据 | 路径 |
|------|------|
| SQLite 数据库 | `~/Library/Application Support/photo-rater/photo_rater.db` (macOS) |
| 缩略图缓存 | `~/Library/Caches/com.photorater.desktop/thumbs/` (macOS) |

## 开发路线

- [x] **M0** 项目脚手架 — Tauri v2 + React + Vite + TypeScript
- [x] **M1** 文件扫描 + 缩略图网格 — walkdir 扫描 + EXIF 读取 + CSS Grid 展示
- [x] **M2** 手动评分 + SQLite 存储 + 筛选导出 — 完整评分/筛选/排序/导出流程
- [x] **M2.5** 性能优化 — Asset Protocol + 磁盘缓存 + 批量 IPC + 懒加载
- [x] **M2.6** Lightbox 全功能查看器 — 缩放/旋转/翻转/全屏/复位/缩略图导航
- [x] **M2.7** Web 调试环境 — Mock 层 + Vite Alias + 占位图
- [ ] **M3** AI 预筛 — NIMA ONNX 模型评分（接入深度学习模型替代启发式信号）
- [ ] **M4** 打磨发布 — UI 打磨、打包分发、自动更新

