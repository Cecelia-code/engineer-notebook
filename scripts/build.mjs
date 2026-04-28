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
  title: "Signal Stack",
  description: "记录技术笔记、工作流、踩坑与复盘的个人博客。",
  author: "你的名字",
  email: "you@example.com",
  siteUrl: "https://example.com",
  language: "zh-CN",
  heroTitle: "技术流博客，用来写明白每一次思考。",
  heroIntro:
    "这里适合持续整理前端、后端、工程化、效率工具和日常踩坑笔记。把零散经验沉淀成能复用的知识资产。",
  now: "最近在整理博客系统、前端工程化笔记和命令行工作流。"
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
  } catch (error) {
    throw new Error(
      "无法解析 marked 依赖。请先执行 npm install，或使用 build.ps1 / dev.ps1 调用内置运行时。"
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
  return [...posts].sort((left, right) => {
    return new Date(right.date).getTime() - new Date(left.date).getTime();
  });
}

function uniqueTags(posts) {
  const countMap = new Map();
  for (const post of posts) {
    for (const tag of post.tags) {
      countMap.set(tag, (countMap.get(tag) ?? 0) + 1);
    }
  }

  return [...countMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0], "zh-CN"))
    .map(([name, count]) => ({
      name,
      slug: slugify(name),
      count
    }));
}

function postCard(post, pathToRoot) {
  return `
    <article class="post-card" data-post-card data-title="${escapeHtml(post.title)}" data-summary="${escapeHtml(
      post.summary
    )}" data-tags="${escapeHtml(post.tags.join(" "))}">
      <div class="post-card__meta">
        <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.displayDate)}</time>
        <span>${post.readingTime} 分钟</span>
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

function pageShell({
  config,
  title,
  description,
  pathToRoot,
  bodyClass = "",
  route = "",
  content
}) {
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
    <meta name="theme-color" content="#0c1b2a" />
    <meta name="generator" content="Signal Stack Static Builder" />
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
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=Noto+Sans+SC:wght@400;500;700;900&family=Space+Grotesk:wght@500;700&display=swap" rel="stylesheet" />
    <script src="https://identity.netlify.com/v1/netlify-identity-widget.js"></script>
    <link rel="stylesheet" href="${fromRoot(pathToRoot, "assets/style.css")}" />
  </head>
  <body class="${escapeHtml(bodyClass)}">
    <div class="site-bg"></div>
    <header class="site-header">
      <div class="shell">
        <a class="brand" href="${fromRoot(pathToRoot, "index.html")}">
          <span class="brand__mark">S</span>
          <span>
            <strong>${escapeHtml(config.title)}</strong>
            <small>Tech notes and working drafts</small>
          </span>
        </a>
        <nav class="nav">
          <a href="${fromRoot(pathToRoot, "index.html")}">首页</a>
          <a href="${fromRoot(pathToRoot, "tags/")}">标签</a>
          <a href="${fromRoot(pathToRoot, "archive/")}">归档</a>
          <a href="${fromRoot(pathToRoot, "feed.xml")}">RSS</a>
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
        <div>
          <p>作者：${escapeHtml(config.author)}</p>
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

function fromRoot(pathToRoot, target) {
  if (!target) {
    return pathToRoot;
  }
  return pathToRoot === "." ? `./${target}` : `${pathToRoot}/${target}`;
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
    const summary = truncateText(String(data.summary || paragraphText || ""), 120);
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
  const featuredPosts = posts.filter((post) => post.featured);
  const primaryPosts = featuredPosts.length >= 3 ? featuredPosts : posts.slice(0, 6);
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
        <div class="hero__copy">
          <span class="eyebrow">Markdown Driven Knowledge Base</span>
          <h1>${escapeHtml(config.heroTitle)}</h1>
          <p class="hero__intro">${escapeHtml(config.heroIntro)}</p>
          <div class="hero__actions">
            <a class="button button--primary" href="./archive/">查看全部文章</a>
            <a class="button button--ghost" href="./tags/">按标签浏览</a>
          </div>
        </div>
        <aside class="hero__panel">
          <div class="status-card">
            <span class="status-card__label">Now</span>
            <p>${escapeHtml(config.now)}</p>
          </div>
          <div class="metric-grid">
            <div>
              <strong>${posts.length}</strong>
              <span>篇笔记</span>
            </div>
            <div>
              <strong>${tags.length}</strong>
              <span>个主题</span>
            </div>
            <div>
              <strong>RSS</strong>
              <span>可订阅</span>
            </div>
            <div>
              <strong>Static</strong>
              <span>部署简单</span>
            </div>
          </div>
        </aside>
      </section>

      <section class="shell section">
        <div class="section__heading">
          <div>
            <span class="eyebrow">Recent Writing</span>
            <h2>最近整理的内容</h2>
          </div>
          <p>适合拿来放技术总结、踩坑记录、复盘文档和实验性草稿。</p>
        </div>
        <div class="filter-bar">
          <label class="search-box">
            <span>搜索</span>
            <input type="search" data-search-input placeholder="试试搜 React、CLI、工程化..." />
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
        <p class="filter-result" data-filter-result>显示 ${primaryPosts.length} 篇内容</p>
        <div class="post-grid" data-post-grid>
          ${primaryPosts.map((post) => postCard(post, ".")).join("")}
        </div>
      </section>

      <section class="shell section topics">
        <div class="section__heading">
          <div>
            <span class="eyebrow">Topic Map</span>
            <h2>你可以怎么组织笔记</h2>
          </div>
          <p>标签页适合长期积累知识库，文章页适合单篇深挖。</p>
        </div>
        <div class="topic-grid">
          ${tags
            .map(
              (tag) => `
                <a class="topic-card" href="./tags/${tag.slug}/">
                  <strong>${escapeHtml(tag.name)}</strong>
                  <span>${tag.count} 篇</span>
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
    title: `归档 | ${config.title}`,
    description: `按时间浏览 ${config.title} 的全部文章`,
    pathToRoot: "..",
    route: "archive/",
    content: `
      <section class="shell page-head">
        <span class="eyebrow">Archive</span>
        <h1>全部归档</h1>
        <p>按年份回看文章和笔记，适合整理成长线项目的演进记录。</p>
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
    title: `标签 | ${config.title}`,
    description: `浏览 ${config.title} 的全部标签`,
    pathToRoot: "..",
    route: "tags/",
    content: `
      <section class="shell page-head">
        <span class="eyebrow">Tags</span>
        <h1>按主题浏览</h1>
        <p>把 React、后端、工程化、效率工具这类主题拆开管理，查找会轻松很多。</p>
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
        <span class="eyebrow">Tag View</span>
        <h1>${escapeHtml(tag.name)}</h1>
        <p>共 ${posts.length} 篇内容，适合把同一类知识持续累计在一个主题下。</p>
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
            <a class="back-link" href="../../archive/">← 返回归档</a>
            <span class="eyebrow">Post</span>
            <h1>${escapeHtml(post.title)}</h1>
            <p>${escapeHtml(post.summary)}</p>
            <div class="article__meta">
              <time datetime="${escapeHtml(post.date)}">${escapeHtml(post.displayDate)}</time>
              <span>${post.readingTime} 分钟阅读</span>
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
            <span class="eyebrow">On This Page</span>
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
                  : "<li class=\"toc__item\">这篇文章还没有目录结构。</li>"
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
    title: `未找到页面 | ${config.title}`,
    description: "页面不存在",
    pathToRoot: ".",
    content: `
      <section class="shell page-head page-head--center">
        <span class="eyebrow">404</span>
        <h1>这页还没写好</h1>
        <p>链接可能已经变动，或者这篇笔记还没发布。</p>
        <a class="button button--primary" href="./index.html">回到首页</a>
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
