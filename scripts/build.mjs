import fs from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const CONTENT_DIR = path.join(ROOT_DIR, "content", "posts");
const PUBLIC_DIR = path.join(ROOT_DIR, "public");
export const DIST_DIR = path.join(ROOT_DIR, "dist");

const DEFAULT_CONFIG = {
  title: "Cecelia Engineer Notebook",
  description: "一个偏长期主义的个人技术博客，写工程经验、架构思考、工作流和高质量技术笔记。",
  author: "Cecelia",
  email: "hello@cecelia-notes.dev",
  siteUrl: "https://example.com",
  language: "zh-CN",
  heroTitle: "把技术经验写成作品，而不是堆成碎片。",
  heroIntro:
    "这里记录前端工程、系统设计、自动化工作流和个人方法论。目标不是刷存在感，而是把每一次思考都沉淀成能复用的结构。",
  now: "最近在搭建个人技术写作系统、改进文章编排体验，并持续整理前端和工程化笔记。",
  tagline: "Essays, systems, notes, and calm engineering."
};

const require = createRequire(import.meta.url);
const MARKED_ENTRY = resolveMarkedEntry();
const { marked } = await import(pathToFileURL(MARKED_ENTRY).href);

function resolveMarkedEntry() {
  const lookupPaths = [ROOT_DIR];
  if (process.env.NODE_PATH) {
    lookupPaths.push(
      ...process.env.NODE_PATH
        .split(path.delimiter)
        .map((item) => item.trim())
        .filter(Boolean)
    );
  }

  try {
    return require.resolve("marked", { paths: lookupPaths });
  } catch {
    throw new Error(
      "Unable to resolve the marked package. Run npm install locally or use build.cmd with the bundled runtime."
    );
  }
}

function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "") || "untitled";
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(value) {
  return String(value)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength) {
  const chars = [...String(value)];
  if (chars.length <= maxLength) {
    return String(value);
  }
  return `${chars.slice(0, maxLength).join("")}...`;
}

function parseScalar(value) {
  const raw = value.trim();
  if (!raw) {
    return "";
  }
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  if (/^\d+$/.test(raw)) {
    return Number(raw);
  }
  if (
    (raw.startsWith('"') && raw.endsWith('"')) ||
    (raw.startsWith("'") && raw.endsWith("'"))
  ) {
    return raw.slice(1, -1);
  }
  if (raw.startsWith("[") && raw.endsWith("]")) {
    return raw
      .slice(1, -1)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) =>
        item.startsWith('"') && item.endsWith('"') ? item.slice(1, -1) : item
      );
  }
  return raw;
}

function parseFrontmatter(fileContent) {
  const normalized = fileContent.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { data: {}, body: normalized.trim() };
  }

  const closingIndex = normalized.indexOf("\n---\n", 4);
  if (closingIndex === -1) {
    return { data: {}, body: normalized.trim() };
  }

  const rawData = normalized.slice(4, closingIndex);
  const body = normalized.slice(closingIndex + 5).trim();
  const data = {};

  for (const line of rawData.split("\n")) {
    if (!line.trim() || line.trim().startsWith("#")) {
      continue;
    }

    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1);
    data[key] = parseScalar(value);
  }

  return { data, body };
}

function countReadingUnits(text) {
  const normalized = text.replace(/`{1,3}[\s\S]*?`{1,3}/g, " ");
  const latinWords = normalized.match(/[A-Za-z0-9_]+/g)?.length ?? 0;
  const hanChars = normalized.match(/\p{Script=Han}/gu)?.length ?? 0;
  return latinWords + hanChars;
}

function collectParagraphText(tokens) {
  for (const token of tokens) {
    if (token.type === "paragraph") {
      return token.text;
    }
    if (token.type === "blockquote" && Array.isArray(token.tokens)) {
      const nested = collectParagraphText(token.tokens);
      if (nested) {
        return nested;
      }
    }
  }
  return "";
}

function renderMarkdown(body) {
  const tokens = marked.lexer(body);
  const headings = [];
  const slugCounts = new Map();
  const renderer = new marked.Renderer();

  renderer.heading = function heading(token) {
    const base = slugify(token.text);
    const used = slugCounts.get(base) ?? 0;
    slugCounts.set(base, used + 1);
    const id = used === 0 ? base : `${base}-${used + 1}`;

    if (token.depth <= 3) {
      headings.push({
        depth: token.depth,
        id,
        text: token.text
      });
    }

    return `<h${token.depth} id="${id}">${this.parser.parseInline(token.tokens)}</h${token.depth}>`;
  };

  const html = marked.parse(body, { renderer });
  return { html, headings, tokens };
}

function formatDisplayDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  }).format(date);
}

function formatMachineDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString();
}

function sortByDateDescending(posts) {
  return [...posts].sort(
    (left, right) => new Date(right.date).getTime() - new Date(left.date).getTime()
  );
}

function uniqueTags(posts) {
  const countMap = new Map();
  for (const post of posts) {
    for (const tag of post.tags) {
      countMap.set(tag, (countMap.get(tag) ?? 0) + 1);
    }
  }

  return [...countMap.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"))
    .map(([name, count]) => ({
      name,
      slug: slugify(name),
      count
    }));
}

function fromRoot(pathToRoot, target) {
  if (!target) {
    return pathToRoot;
  }
  return pathToRoot === "." ? `./${target}` : `${pathToRoot}/${target}`;
}

function postCard(post, pathToRoot) {
  return `
    <article class="post-card" data-post-card data-title="${escapeHtml(post.title)}" data-summary="${escapeHtml(
      post.summary
    )}" data-tags="${escapeHtml(post.tags.join(" "))}">
      <div class="post-card__meta">
        <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.displayDate)}</time>
        <span>${post.readingTime} 分钟阅读</span>
      </div>
      <h3><a href="${fromRoot(pathToRoot, `posts/${post.slug}/`)}">${escapeHtml(post.title)}</a></h3>
      <p>${escapeHtml(post.summary)}</p>
      <div class="chip-row">
        ${post.tags
          .map(
            (tag) =>
              `<a class="chip" href="${fromRoot(pathToRoot, `tags/${slugify(tag)}/`)}">${escapeHtml(
                tag
              )}</a>`
          )
          .join("")}
      </div>
    </article>
  `;
}

function compactPostLink(post, pathToRoot) {
  return `
    <a class="compact-post" href="${fromRoot(pathToRoot, `posts/${post.slug}/`)}">
      <span class="compact-post__date">${escapeHtml(post.displayDate)}</span>
      <strong>${escapeHtml(post.title)}</strong>
      <span class="compact-post__summary">${escapeHtml(post.summary)}</span>
    </a>
  `;
}

function featurePost(post, pathToRoot) {
  return `
    <article class="feature-post">
      <div class="feature-post__meta">
        <span class="eyebrow eyebrow--accent">精选文章</span>
        <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.displayDate)}</time>
      </div>
      <h2><a href="${fromRoot(pathToRoot, `posts/${post.slug}/`)}">${escapeHtml(post.title)}</a></h2>
      <p>${escapeHtml(post.summary)}</p>
      <div class="feature-post__footer">
        <div class="chip-row">
          ${post.tags
            .map(
              (tag) =>
                `<a class="chip" href="${fromRoot(pathToRoot, `tags/${slugify(tag)}/`)}">${escapeHtml(
                  tag
                )}</a>`
            )
            .join("")}
        </div>
        <span class="feature-post__reading">${post.readingTime} 分钟阅读</span>
      </div>
    </article>
  `;
}

function pageShell({ config, title, description, pathToRoot, route = "", bodyClass = "", content }) {
  const canonical =
    config.siteUrl && !config.siteUrl.includes("example.com")
      ? `${config.siteUrl.replace(/\/$/, "")}/${route}`.replace(/\/+$/, "/")
      : "";

  return `<!doctype html>
<html lang="${escapeHtml(config.language)}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
    <meta name="theme-color" content="#f7faf8" />
    <meta name="generator" content="Cecelia Engineer Notebook" />
    ${canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}" />` : ""}
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:type" content="website" />
    ${canonical ? `<meta property="og:url" content="${escapeHtml(canonical)}" />` : ""}
    <link rel="alternate" type="application/rss+xml" title="${escapeHtml(
      config.title
    )}" href="${fromRoot(pathToRoot, "feed.xml")}" />
    <link rel="icon" href="${fromRoot(pathToRoot, "assets/favicon.svg")}" type="image/svg+xml" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
    <script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
    <link rel="stylesheet" href="${fromRoot(pathToRoot, "assets/style.css")}" />
  </head>
  <body class="${escapeHtml(bodyClass)}">
    <div class="site-noise" aria-hidden="true"></div>
    <header class="site-header">
      <div class="shell site-header__inner">
        <a class="brand" href="${fromRoot(pathToRoot, "index.html")}">
          <span class="brand__mark">C</span>
          <span class="brand__copy">
            <strong>${escapeHtml(config.title)}</strong>
            <small>${escapeHtml(config.tagline || DEFAULT_CONFIG.tagline)}</small>
          </span>
        </a>
        <nav class="nav">
          <a href="${fromRoot(pathToRoot, "index.html")}">首页</a>
          <a href="${fromRoot(pathToRoot, "tags/")}">主题</a>
          <a href="${fromRoot(pathToRoot, "archive/")}">归档</a>
          <a href="${fromRoot(pathToRoot, "feed.xml")}">RSS</a>
          <a href="${fromRoot(pathToRoot, "admin/")}">后台</a>
        </nav>
      </div>
    </header>
    <main>${content}</main>
    <footer class="site-footer">
      <div class="shell site-footer__inner">
        <div>
          <strong>${escapeHtml(config.title)}</strong>
          <p>${escapeHtml(config.description)}</p>
        </div>
        <div class="site-footer__meta">
          <p>${escapeHtml(config.author)}</p>
          <p><a href="mailto:${escapeHtml(config.email)}">${escapeHtml(config.email)}</a></p>
        </div>
      </div>
    </footer>
    <script>
      if (window.netlifyIdentity) {
        window.netlifyIdentity.on("init", function (user) {
          if (!user) {
            window.netlifyIdentity.on("login", function () {
              document.location.href = "${fromRoot(pathToRoot, "admin/")}";
            });
          }
        });
      }
    </script>
    <script type="module" src="${fromRoot(pathToRoot, "assets/app.js")}"></script>
  </body>
</html>`;
}

function archiveGroups(posts) {
  const groups = new Map();
  for (const post of posts) {
    const year = new Date(post.date).getFullYear();
    if (!groups.has(year)) {
      groups.set(year, []);
    }
    groups.get(year).push(post);
  }
  return [...groups.entries()].sort((a, b) => b[0] - a[0]);
}

async function copyDirectory(sourceDir, destinationDir) {
  if (!existsSync(sourceDir)) {
    return;
  }

  await fs.mkdir(destinationDir, { recursive: true });
  const items = await fs.readdir(sourceDir, { withFileTypes: true });

  for (const item of items) {
    const sourcePath = path.join(sourceDir, item.name);
    const destinationPath = path.join(destinationDir, item.name);
    if (item.isDirectory()) {
      await copyDirectory(sourcePath, destinationPath);
    } else {
      await fs.copyFile(sourcePath, destinationPath);
    }
  }
}

async function ensureCleanDist() {
  await fs.rm(DIST_DIR, { recursive: true, force: true });
  await fs.mkdir(DIST_DIR, { recursive: true });
}

async function loadConfig() {
  const configPath = path.join(ROOT_DIR, "site.config.json");
  const raw = await fs.readFile(configPath, "utf8");
  return {
    ...DEFAULT_CONFIG,
    ...JSON.parse(raw)
  };
}

async function loadPosts() {
  const entries = await fs.readdir(CONTENT_DIR, { withFileTypes: true });
  const posts = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".md")) {
      continue;
    }

    const filePath = path.join(CONTENT_DIR, entry.name);
    const raw = await fs.readFile(filePath, "utf8");
    const { data, body } = parseFrontmatter(raw);
    const rendered = renderMarkdown(body);
    const date = String(data.date || new Date().toISOString().slice(0, 10));
    const tags = Array.isArray(data.tags)
      ? data.tags.map((item) => String(item).trim()).filter(Boolean)
      : String(data.tags || "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean);

    const paragraphText = collectParagraphText(rendered.tokens);
    const summary = truncateText(String(data.summary || paragraphText || ""), 128);
    const rawText = stripHtml(rendered.html);
    const readingTime = Math.max(1, Math.ceil(countReadingUnits(rawText) / 260));

    posts.push({
      slug: slugify(data.slug || entry.name.replace(/\.md$/i, "")),
      title: String(data.title || entry.name.replace(/\.md$/i, "")),
      summary,
      date,
      displayDate: formatDisplayDate(date),
      machineDate: formatMachineDate(date),
      tags,
      featured: Boolean(data.featured),
      draft: Boolean(data.draft),
      html: rendered.html,
      headings: rendered.headings,
      readingTime
    });
  }

  return sortByDateDescending(posts).filter((post) => !post.draft);
}

function renderHomePage(config, posts, tags) {
  const heroPosts = posts.filter((post) => post.featured);
  const leadPost = heroPosts[0] || posts[0];
  const sidePosts = heroPosts.slice(1, 4).length ? heroPosts.slice(1, 4) : posts.slice(1, 4);
  const searchablePosts = posts.slice(0, 9);
  const activeTags = tags.slice(0, 10);

  return pageShell({
    config,
    title: `${config.title} | ${config.description}`,
    description: config.description,
    pathToRoot: ".",
    route: "",
    bodyClass: "home-page",
    content: `
      <section class="hero shell">
        <div class="hero__intro-panel">
          <div class="hero__eyebrow-row">
            <span class="eyebrow">技术笔记</span>
            <span class="hero__status">持续更新</span>
          </div>
          <h1>${escapeHtml(config.heroTitle)}</h1>
          <p class="hero__intro">${escapeHtml(config.heroIntro)}</p>
          <div class="hero__actions">
            <a class="button button--primary" href="./archive/">查看文章</a>
            <a class="button button--ghost" href="./admin/">写新文章</a>
          </div>
          <dl class="hero__metrics">
            <div>
              <dt>文章</dt>
              <dd>${posts.length}</dd>
            </div>
            <div>
              <dt>主题</dt>
              <dd>${tags.length}</dd>
            </div>
            <div>
              <dt>写作方式</dt>
              <dd>Markdown 写作</dd>
            </div>
          </dl>
        </div>
        <aside class="hero__sidebar">
          <div class="profile-card">
            <span class="eyebrow eyebrow--accent">当前记录</span>
            <h2>${escapeHtml(config.author)}</h2>
            <p>${escapeHtml(config.now)}</p>
            <div class="profile-card__tags">
              <span>前端工程</span>
              <span>工具链</span>
              <span>效率工作流</span>
            </div>
          </div>
          <div class="manifest-card">
            <span class="eyebrow eyebrow--accent">写作方式</span>
            <p>偏系统、偏写作、偏长期积累。这个博客不是展示面板，而是一个持续生产知识资产的工作台。</p>
          </div>
        </aside>
      </section>

      ${
        leadPost
          ? `
      <section class="shell spotlight">
        ${featurePost(leadPost, ".")}
        <div class="spotlight__rail">
          <div class="spotlight__heading">
            <span class="eyebrow">最近更新</span>
            <h2>最近在写什么</h2>
          </div>
          ${sidePosts.map((post) => compactPostLink(post, ".")).join("")}
        </div>
      </section>`
          : ""
      }

      <section class="shell section">
        <div class="section__heading">
          <div>
            <span class="eyebrow">文章库</span>
            <h2>文章与笔记库</h2>
          </div>
          <p>这里更像一间整理好的研究室。你可以按主题筛、按关键词找，也可以把它当成自己的技术档案馆。</p>
        </div>
        <div class="filter-bar">
          <label class="search-box">
            <span>搜索笔记</span>
            <input type="search" data-search-input placeholder="试试搜索 React、CLI、workflow、CSS..." />
          </label>
          <div class="filter-tags">
            <button class="chip chip--button is-active" type="button" data-filter-tag="">全部</button>
            ${activeTags
              .map(
                (tag) =>
                  `<button class="chip chip--button" type="button" data-filter-tag="${escapeHtml(
                    tag.name
                  )}">${escapeHtml(tag.name)}</button>`
              )
              .join("")}
          </div>
        </div>
        <p class="filter-result" data-filter-result>显示 ${searchablePosts.length} 篇内容</p>
        <div class="post-grid" data-post-grid>
          ${searchablePosts.map((post) => postCard(post, ".")).join("")}
        </div>
      </section>

      <section class="shell section">
        <div class="section__heading">
          <div>
            <span class="eyebrow">主题分布</span>
            <h2>长期主题分布</h2>
          </div>
          <p>把文章当作主题积累而不是零散更新，你会更快形成自己的写作脉络和技术视角。</p>
        </div>
        <div class="topic-grid">
          ${tags
            .map(
              (tag) => `
                <a class="topic-card" href="./tags/${tag.slug}/">
                  <strong>${escapeHtml(tag.name)}</strong>
                  <span>${tag.count} 篇文章</span>
                </a>
              `
            )
            .join("")}
        </div>
      </section>
    `
  });
}

function renderArchivePage(config, posts) {
  const groups = archiveGroups(posts);

  return pageShell({
    config,
    title: `Archive | ${config.title}`,
    description: `按时间浏览 ${config.title} 的全部文章`,
    pathToRoot: "..",
    route: "archive/",
    content: `
      <section class="shell page-head">
        <span class="eyebrow">Archive</span>
        <h1>按时间浏览全部文章</h1>
        <p>适合回看某一阶段的持续输出，也适合整理长期主题的演进过程。</p>
      </section>
      <section class="shell section">
        <div class="archive-list">
          ${groups
            .map(
              ([year, yearPosts]) => `
                <section class="archive-group">
                  <div class="archive-group__year">${year}</div>
                  <div class="archive-group__items">
                    ${yearPosts
                      .map(
                        (post) => `
                          <article class="archive-item">
                            <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.displayDate)}</time>
                            <div>
                              <h2><a href="../posts/${post.slug}/">${escapeHtml(post.title)}</a></h2>
                              <p>${escapeHtml(post.summary)}</p>
                            </div>
                          </article>
                        `
                      )
                      .join("")}
                  </div>
                </section>
              `
            )
            .join("")}
        </div>
      </section>
    `
  });
}

function renderTagsIndexPage(config, tags) {
  return pageShell({
    config,
    title: `Topics | ${config.title}`,
    description: `浏览 ${config.title} 的全部主题`,
    pathToRoot: "..",
    route: "tags/",
    content: `
      <section class="shell page-head">
        <span class="eyebrow">Topics</span>
        <h1>从主题而不是时间看内容</h1>
        <p>如果你把博客当作知识系统，主题页往往比首页更有价值。</p>
      </section>
      <section class="shell section">
        <div class="topic-grid">
          ${tags
            .map(
              (tag) => `
                <a class="topic-card" href="./${tag.slug}/">
                  <strong>${escapeHtml(tag.name)}</strong>
                  <span>${tag.count} 篇文章</span>
                </a>
              `
            )
            .join("")}
        </div>
      </section>
    `
  });
}

function renderTagPage(config, tag, posts) {
  return pageShell({
    config,
    title: `${tag.name} | ${config.title}`,
    description: `浏览 ${tag.name} 主题下的文章`,
    pathToRoot: "../..",
    route: `tags/${tag.slug}/`,
    content: `
      <section class="shell page-head">
        <span class="eyebrow">Topic view</span>
        <h1>${escapeHtml(tag.name)}</h1>
        <p>共 ${posts.length} 篇内容。主题页适合沉淀长期写作，不只是短期更新。</p>
      </section>
      <section class="shell section">
        <div class="post-grid">
          ${posts.map((post) => postCard(post, "../..")).join("")}
        </div>
      </section>
    `
  });
}

function renderPostPage(config, post, previousPost, nextPost) {
  return pageShell({
    config,
    title: `${post.title} | ${config.title}`,
    description: post.summary,
    pathToRoot: "../..",
    route: `posts/${post.slug}/`,
    bodyClass: "post-page",
    content: `
      <section class="shell article-shell">
        <article class="article">
          <div class="article__header">
            <a class="back-link" href="../../archive/">Back to archive</a>
            <span class="eyebrow">Essay</span>
            <h1>${escapeHtml(post.title)}</h1>
            <p>${escapeHtml(post.summary)}</p>
            <div class="article__meta">
              <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.displayDate)}</time>
              <span>${post.readingTime} min read</span>
            </div>
            <div class="chip-row">
              ${post.tags
                .map(
                  (tag) =>
                    `<a class="chip" href="../../tags/${slugify(tag)}/">${escapeHtml(tag)}</a>`
                )
                .join("")}
            </div>
          </div>
          <div class="article__content markdown-body">
            ${post.html}
          </div>
          <nav class="article-pager">
            ${
              previousPost
                ? `<a href="../../posts/${previousPost.slug}/"><small>上一篇</small><strong>${escapeHtml(
                    previousPost.title
                  )}</strong></a>`
                : `<span class="article-pager__empty"></span>`
            }
            ${
              nextPost
                ? `<a href="../../posts/${nextPost.slug}/"><small>下一篇</small><strong>${escapeHtml(
                    nextPost.title
                  )}</strong></a>`
                : `<span class="article-pager__empty"></span>`
            }
          </nav>
        </article>
        <aside class="article-aside">
          <div class="aside-card">
            <span class="eyebrow eyebrow--accent">On this page</span>
            <ul class="toc">
              ${
                post.headings.length
                  ? post.headings
                      .map(
                        (heading) => `
                          <li class="toc__item toc__item--${heading.depth}">
                            <a href="#${heading.id}">${escapeHtml(heading.text)}</a>
                          </li>
                        `
                      )
                      .join("")
                  : '<li class="toc__item">这篇文章目前没有目录。</li>'
              }
            </ul>
          </div>
        </aside>
      </section>
    `
  });
}

function render404Page(config) {
  return pageShell({
    config,
    title: `Not found | ${config.title}`,
    description: "页面不存在",
    pathToRoot: ".",
    content: `
      <section class="shell page-head page-head--center">
        <span class="eyebrow">404</span>
        <h1>这页没有被发布</h1>
        <p>可能链接已经变化，也可能这篇内容还在草稿阶段。</p>
        <a class="button button--primary" href="./index.html">Return home</a>
      </section>
    `
  });
}

function renderFeed(config, posts) {
  const base = config.siteUrl.replace(/\/$/, "");
  const items = posts
    .map(
      (post) => `
  <item>
    <title><![CDATA[${post.title}]]></title>
    <link>${base}/posts/${post.slug}/</link>
    <guid>${base}/posts/${post.slug}/</guid>
    <pubDate>${new Date(post.machineDate).toUTCString()}</pubDate>
    <description><![CDATA[${post.summary}]]></description>
  </item>`
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
  <channel>
    <title><![CDATA[${config.title}]]></title>
    <link>${base}</link>
    <description><![CDATA[${config.description}]]></description>
    <language>${config.language}</language>
    ${items}
  </channel>
</rss>`;
}

async function writePage(relativePath, content) {
  const outputPath = path.join(DIST_DIR, relativePath);
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(outputPath, content, "utf8");
}

export async function build() {
  const config = await loadConfig();
  const posts = await loadPosts();
  const tags = uniqueTags(posts);

  await ensureCleanDist();
  await copyDirectory(PUBLIC_DIR, DIST_DIR);

  await writePage("index.html", renderHomePage(config, posts, tags));
  await writePage("archive/index.html", renderArchivePage(config, posts));
  await writePage("tags/index.html", renderTagsIndexPage(config, tags));
  await writePage("404.html", render404Page(config));
  await writePage("feed.xml", renderFeed(config, posts));

  for (const [index, post] of posts.entries()) {
    const previousPost = posts[index + 1] ?? null;
    const nextPost = posts[index - 1] ?? null;
    await writePage(
      `posts/${post.slug}/index.html`,
      renderPostPage(config, post, previousPost, nextPost)
    );
  }

  for (const tag of tags) {
    const taggedPosts = posts.filter((post) => post.tags.includes(tag.name));
    await writePage(`tags/${tag.slug}/index.html`, renderTagPage(config, tag, taggedPosts));
  }

  console.log(`Built ${posts.length} posts into ${DIST_DIR}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  await build();
}
