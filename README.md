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

### 你需要先改的内容

先把 `public/admin/config.yml` 里的这些值换成你自己的：

```yml
backend:
  repo: your-github-name/your-repo-name

site_url: https://your-site.example.com
display_url: https://your-site.example.com
```

### 认证方案

这个项目我默认帮你接成了 `GitHub backend`，适合部署在 GitHub Pages 或 Vercel。

但这里有个关键点：Decap CMS 连接 GitHub 时，**还需要一个认证服务**。  
也就是说，现在代码结构已经接好了，但你上线前还要把认证补上，后台才能真正登录写文章。

你有两条路：

#### 方案 A：GitHub backend + OAuth Proxy

适合 GitHub Pages / Vercel。

你需要：

1. 准备 GitHub OAuth App。
2. 部署一个 OAuth Proxy。
3. 把 `public/admin/config.yml` 里的这两项补上：

```yml
backend:
  base_url: https://cms-auth.your-domain.com
  auth_endpoint: auth
```

#### 方案 B：Netlify Identity + Git Gateway

如果你不想自己搭 OAuth Proxy，可以让 Netlify 只负责认证，博客本体仍然放 GitHub Pages 或 Vercel。

步骤是：

1. 在 Netlify 开一个站点并启用 Identity。
2. 启用 Git Gateway。
3. 把 `public/admin/config.git-gateway.example.yml` 的内容覆盖到 `public/admin/config.yml`。

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
