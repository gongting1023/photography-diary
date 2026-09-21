# 龚仔的摄影日记

一个基于 Cloudinary 图床的动态相册网站，实时从 Cloudinary 加载相册和照片。

> **📷 致每一位爱记录的摄影小伙伴！**
>
> 本项目完全免费开源，只希望能帮助更多的摄影小伙伴拥有属于自己的摄影小窝。
> 因为热爱摄影的我，所以完成了此初版本，后续有更多 idea 会进行持续优化。
>
> 你们有好的建议也可以和我进行反馈哈。也欢迎大家进行二次开发创作。
>
> 因为热爱让我们相聚于此！
>
> 希望大家都找到属于自己的 25 号底片！

👉 [**在线演示**](https://gongting.fun) — 查看完整效果

---

## 功能特性

- 📷 **Cloudinary 图床** — 照片传上 Cloudinary，网站按文件夹自动生成相册
- 🎞️ **全屏视频 Hero** — 多段压缩 WebM 视频循环自动播放，16:9 无裁切铺满首屏，沉浸式夜境氛围
- 🖼️ **专业图片查看器** — 点击照片全屏浏览，支持键盘 ← →、鼠标滚轮缩放、双指捏合、双击放大、拖拽平移、滑动手势
- 📱 **全端适配** — 电脑、平板、手机都能完美显示，手机端单独优化（大触摸按钮、EXIF 常显）
- 🌙 **固定深色主题** — 固定暗色沉浸式风格，iOS 风格毛玻璃效果
- 🔄 **自动同步** — 增删照片后网站实时更新，无需手动操作
- 🔒 **密钥安全** — API 密钥由 Netlify Functions 保护，不暴露前端
- ⚡ **懒加载 & 占位图** — 图片懒加载 + 模糊占位图，视频压缩为 WebM 优化加载
- 📑 **分页浏览** — 相册和照片都支持分页，翻页状态回退自动恢复
- 🚀 **一键部署** — 点击按钮即可部署到 Netlify，无需写代码
- 🎨 **彩蛋交互** — 点击「定格美好」触发地震/快门特效、点击年份撒卡片彩纸、点击标语绽放星光
- 🧩 **PWA 支持** — 可安装到手机桌面，类原生体验
- ✏️ **完全可配置** — 修改 `config.js` 即可自定义站点名称、标语、底部社交链接
- 🆓 **开源免费** — MIT 协议，自由使用、二次开发

---

## 技术栈介绍

本项目选用了三个免费且强大的工具，让摄影网站搭建变得简单：

### 🏗️ Eleventy（静态网站生成器）

**为什么选它？** 不像 React/Vue 那么重，Eleventy 只生成纯 HTML/CSS/JS 文件，不需要数据库，不需要服务器端渲染。

- 轻量、快速、灵活
- 使用 Nunjucks 模板语法，简单易懂
- 生成的网站可以直接部署到任何静态托管平台

### 🖼️ Cloudinary（图床 + CDN）

**为什么选它？** 免费版提供 25GB 存储空间和每月额度，对个人摄影网站基本够用（具体额度以 [官网](https://cloudinary.com/pricing) 为准）。

- 自动图片优化和 CDN 加速，加载速度快
- 支持按文件夹分类，网站自动按文件夹生成相册
- 提供 API 接口，方便网站动态获取照片列表
- 上传照片后自动处理多种尺寸（缩略图、原图等）

### 🚀 Netlify（免费部署平台）

**为什么选它？** 一键部署、自动 HTTPS、全球 CDN，个人项目完全免费。

- 连接 GitHub 仓库，推送代码自动部署
- 免费提供 `*.netlify.app` 域名，也支持绑定自定义域名
- 内置 Serverless Functions，保护 API 密钥不暴露前端
- 每月 100GB 免费流量，个人网站很难用完

---

## 快速开始

### 💻 本地开发（有基础）

需要你电脑上装了 [Node.js](https://nodejs.org/)（建议 v16+）。

**第一步：克隆项目**

```bash
git clone https://github.com/gongting1023/photography-diary.git
cd photography-diary
```

**第二步：安装依赖**

```bash
npm install
```

**第三步：配置环境变量**

项目根目录有个 `.env.example` 文件，复制并重命名为 `.env`：

```bash
# Mac / Linux
cp .env.example .env

# Windows
copy .env.example .env
```

用记事本打开 `.env`，填入你的 Cloudinary 密钥：

```env
CLOUDINARY_CLOUD_NAME=你的云名称
CLOUDINARY_API_KEY=你的API Key
CLOUDINARY_API_SECRET=你的API Secret
```

> 没有 Cloudinary 账号？去 [Cloudinary](https://cloudinary.com) 免费注册一个。

**第四步：自定义网站信息（可选）**

编辑根目录的 `config.js`，把名称、标语、描述、底部社交链接改成你自己的：

```js
module.exports = {
  siteName: '龚仔的摄影日记',           // 网站名称
  siteTitle: '记录生活，定格美好',        // 标题/口号
  siteDescription: '用镜头捕捉每一个值得珍藏的瞬间', // 描述
  footer: {
    social: [
      { label: '小红书', url: 'https://...', brand: 'xiaohongshu' },
      { label: '抖音', url: 'https://...', brand: 'douyin' },
      { label: '邮箱：你的邮箱', url: 'mailto:...' }
    ]
  }
};
```

**第五步：构建静态文件**

```bash
npm run build
```

> 这一步会生成 `_site/` 目录，本地服务器需要它才能运行。

**第六步：启动开发服务器**

```bash
npm run dev
```

浏览器打开 http://localhost:1023 就能看到效果了。

> ⚠️ **改完模板必须重新构建**：`npm run dev` 只是启动静态服务器 + Cloudinary 代理，**不带热重载**。修改 `index.njk` / `album.njk` 等模板后，要重新跑一次 `npm run build`，刷新浏览器才会生效。

> ⚠️ **首次加载较慢**：相册列表需要从 Cloudinary API 拉取全部照片数据，可能要等 10-30 秒，这是正常的。后续访问走内存缓存会快很多，部署到 Netlify 后也有 CDN 缓存加速。

**构建生产版本**

```bash
npm run build
```

构建后的文件会输出到 `_site/` 目录，直接部署到 Netlify 或其他静态托管服务即可。

---

## Hero 视频优化

首页首屏会循环播放多段 Hero 视频。为了兼顾画质与加载速度，视频统一压缩为 **WebM（VP9 / 1080p / CRF 26 / 无声，每段 8 秒）**，存于 `static/video/`，构建时由 `.eleventy.js` 透传复制到 `_site`。

> ⚠️ **体积提醒**
>
> 本项目自带 **117 段视频、合计约 547MB**，会影响两件事：
>
> 1. **仓库 clone 很慢** —— 想学习代码的人第一步就要拖 547MB；
> 2. **Netlify 免费版月流量约 100GB** —— 而 Hero 视频是**循环播放**的，访客停留 5 分钟约消耗 175MB，页面一直挂着的话 1 小时能吃掉 2GB。**不到 50 个挂机访客就可能把整月额度用光**，超限后站点会被暂停。
>
> **建议**：如果你只是想要一个能跑的相册站，先把 `static/video/` 清空或只留少数几段——**视频为空时首屏会自动降级，不影响其他任何功能**。
>
> 想保留氛围又控制流量，可以只留体积小的段。本项目的体积分布很不均匀：**17 段（>8MB）就占了全部体积的 49%，而 44 段（≤2MB）加起来只有 50MB**。只保留后者的话，同样 5 分钟的会话流量能降到 43MB。

### 重新压缩视频

如需更换视频源或重新压缩，把 MP4 放进 `static/video/` 后运行：

```powershell
powershell -ExecutionPolicy Bypass -File scripts/compress-videos.ps1
```

脚本会并行（每次 4 个）把 `static/video/*.mp4` 转成 WebM，覆盖同名 `.webm`；已存在且非空的 `.webm` 会被自动跳过（想强制重压就先删掉它）。参数写在脚本开头：`$crf = 26`、`$duration = 8`，缩放比例在 `-vf scale=1920:1080`。

> ⚠️ **请自行留存源 MP4**。一旦只剩 WebM，再次压缩就变成**二次有损压缩**——原版的压缩伪影本身也占码率，体积降幅会大打折扣（实测 CRF 26 → 34 只能降约 39%）。
>
> 另注：GitHub 单文件硬上限 100MB，建议单文件控制在 50MB 以内，避免 push 被拒或仓库过大。

---

## Cloudinary 配置

1. 注册 [Cloudinary](https://cloudinary.com)
2. 上传照片到对应日期文件夹（如 `2026-01-01`）
3. 网站会自动按文件夹生成相册

> 建议上传时使用有意义的公共 ID 前缀（如 `2026-01-01/sunset`），方便管理。

---

## 项目结构

```
photography-diary/
├── config.js            # 网站配置（名称、标题、社交链接）
├── index.njk            # 首页模板（视频 Hero、相册网格、分页、彩蛋）
├── album.njk            # 相册详情页模板（照片网格、灯箱查看器）
├── exhibition.njk       # 3D 摄影展览页（Three.js，当前 301 跳转到首页）
├── donate.html          # 打赏页
├── manifest.njk         # PWA 清单（可安装到桌面）
├── favicon.svg          # 站点图标
├── _data/
│   └── site.js          # 读取 config.js 供模板使用
├── _includes/
│   └── layouts/         # Eleventy 布局目录
├── .eleventy.js         # Eleventy 构建配置（含 static 静态资源拷贝）
├── static/
│   ├── video/           # 首屏 Hero 视频（WebM，段数可自定义）
│   ├── exhibition.css   # 3D 展览页样式
│   ├── exhibition.js    # 3D 展览页脚本
│   └── ...              # 其他静态资源
├── netlify/
│   └── functions/       # API 接口（保护密钥）
│       ├── albums.js    # 相册列表 API
│       └── album.js     # 单个相册详情 API
├── scripts/
│   ├── local-api.js             # 本地开发 API 服务器
│   ├── compress-videos.ps1      # 视频批量压缩（MP4 → WebM）
│   ├── compress-photos.js       # 照片压缩
│   └── upload-to-cloudinary.js  # 批量上传照片到 Cloudinary
├── demo/                # 演示页
├── server.js            # 纯静态预览服务器（端口 8080，仅服务 _site/，不含 API 代理）
├── .env                 # 环境变量（不上传）
├── .env.example         # 环境变量模板
├── netlify.toml         # Netlify 部署配置（路由重定向 + 安全响应头）
└── _site/               # 构建产物（npm run build 生成，不上传）
```

---

## 部署到 Netlify

### 自动部署（推荐）

1. 把项目推送到 GitHub 仓库
2. 登录 [Netlify](https://app.netlify.com)
3. 点击 **Add new site** → **Import an existing project**
4. 选择你的 GitHub 仓库
5. 构建配置会自动从 `netlify.toml` 读取
6. 在 Netlify 后台设置环境变量（`CLOUDINARY_CLOUD_NAME`、`CLOUDINARY_API_KEY`、`CLOUDINARY_API_SECRET`）
7. 部署完成后即可通过 Netlify 分配的域名访问

### 自定义域名

1. Netlify 后台 → **Domain management** → **Add custom domain**
2. 在域名服务商（如阿里云、Cloudflare）配置 DNS，添加 CNAME 记录指向 Netlify
3. 建议配合 Cloudflare 使用，可获得额外 CDN 加速和 DDoS 防护

### 路由说明

相册详情页的 URL 格式为 `/album/文件夹名`，但它是纯静态页面，需要把 `/album/*` 的请求重写到 `/album/index.html`。这条规则配置在根目录的 **`netlify.toml`** 中：

```toml
[[redirects]]
  from = "/album/*"
  to = "/album/index.html"
  status = 200
```

同一个文件里还包含：`/api/*` 到 Netlify Functions 的转发、`/exhibition` 到首页的 301 跳转，以及全站的 `X-Frame-Options`、`X-Content-Type-Options` 等安全响应头。

> 💡 也可以用 Netlify 传统的 `_redirects` 文件，但本项目的构建目录是 `_site/`，需要额外在 `.eleventy.js` 里加一行 `addPassthroughCopy("_redirects")` 才会被复制进去——所以这里统一用 `netlify.toml` 更省事。

---

## 许可证

MIT License

## 联系方式

- 抖音：[@龚仔仔仔仔](https://v.douyin.com/Hc74k9FgjPY/)
- 小红书：[@龚仔仔仔仔](https://xhslink.com/m/9WzBstwHLKF)
- Email：jogt@foxmail.com

---

*用镜头捕捉每一个值得珍藏的瞬间*
