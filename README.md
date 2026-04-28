# Signal Stack

这是一个从零搭好的个人技术博客，适合持续写技术笔记、踩坑记录、复盘和工作流总结。

## 项目特点

- Markdown 驱动：文章放在 `content/posts/*.md`
- 静态输出：构建后生成到 `dist/`
- 自带首页、文章页、标签页、归档页和 RSS
- 已接入 Decap CMS 后台入口，部署后可网页写文章
- 不依赖重量级框架，后续迁移或定制都比较轻

## 目录结构

```text
content/posts/     文章内容
public/assets/     样式、脚本、图标
public/admin/      Decap CMS 后台
scripts/build.mjs  静态站点生成器
scripts/dev.mjs    本地预览服务
site.config.json   站点标题、描述、作者信息
dist/              构建产物
```

## 在线后台

后台入口已经加好了，部署后访问：

```text
/admin/
```

当前关键文件：

- `public/admin/index.html`
- `public/admin/config.yml`
- `public/admin/config.git-gateway.example.yml`
- `netlify.toml`

### 你需要先改的内容

先把 `public/admin/config.yml` 里的这些值换成你自己的：

```yml
site_url: https://your-site.example.com
display_url: https://your-site.example.com
```

### 认证方案

这个项目现在已经切成 `Netlify Identity + Git Gateway` 路线，方便做在线编辑。

你后面在 Netlify 只要完成这些动作：

1. 导入 GitHub 仓库 `Cecelia-code/engineer-notebook`
2. 构建命令用 `npm run build`
3. 发布目录用 `dist`
4. 打开 `Identity`
5. 打开 `Git Gateway`

现在 `public/admin/config.yml` 已经是：

```yml
backend:
  name: git-gateway
  branch: main
```

## 网页里能改什么

现在后台已经支持直接编辑：

- 文章标题
- 日期
- 摘要
- 标签
- 是否推荐
- 是否草稿
- Markdown 正文
- 图片上传到 `public/uploads`

## 怎么写新文章

在 `content/posts` 下新建一个 `.md` 文件，建议带上这些字段：

```md
---
title: "文章标题"
date: "2026-04-28"
summary: "一句话摘要"
tags: ["标签1", "标签2"]
featured: true
---

# 正文开始
```

## 本地运行

最稳的方式是直接执行：

```powershell
.\dev.cmd
```

默认会启动在 `http://localhost:4321`。

如果你更想走 PowerShell 版本，也可以用：

```powershell
powershell -ExecutionPolicy Bypass -File .\dev.ps1
```

## 构建静态文件

```powershell
.\build.cmd
```

构建结果会输出到 `dist/`。

如果后台已经配好，部署后访问 `/admin/` 就能直接在网页里写文章。

## Netlify 部署

这个项目已经带了 `netlify.toml`，所以在 Netlify 导入仓库时，默认会读取：

```toml
[build]
command = "npm run build"
publish = "dist"
```

PowerShell 版本同样可用：

```powershell
powershell -ExecutionPolicy Bypass -File .\build.ps1
```

## 个性化修改

- 站点标题、作者、描述：改 `site.config.json`
- 首页视觉和排版：改 `public/assets/style.css`
- 页面结构：改 `scripts/build.mjs`

## 以后如果你装了 Node/npm

也可以直接使用：

```powershell
npm install
npm run dev
npm run build
```
