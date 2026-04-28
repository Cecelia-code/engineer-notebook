import fs from "node:fs";
import fsp from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, DIST_DIR } from "./build.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");
const WATCH_DIRS = [
  path.join(ROOT_DIR, "content"),
  path.join(ROOT_DIR, "public"),
  path.join(ROOT_DIR, "scripts"),
  path.join(ROOT_DIR, "site.config.json")
];

const PORT = Number(process.env.PORT || 4321);

let buildQueue = Promise.resolve();
let rebuildTimer = null;

function queueBuild(reason) {
  buildQueue = buildQueue
    .catch(() => undefined)
    .then(async () => {
      console.log(`[build] ${reason}`);
      await build();
    })
    .catch((error) => {
      console.error("[build] failed");
      console.error(error);
    });

  return buildQueue;
}

function scheduleBuild(reason) {
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => {
    void queueBuild(reason);
  }, 120);
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case ".html":
      return "text/html; charset=utf-8";
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "application/javascript; charset=utf-8";
    case ".svg":
      return "image/svg+xml";
    case ".xml":
      return "application/xml; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    default:
      return "application/octet-stream";
  }
}

function resolveRequestPath(urlPath) {
  const cleanPath = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = cleanPath === "/" ? "/index.html" : cleanPath;
  const withIndex = normalized.endsWith("/") ? `${normalized}index.html` : normalized;
  const fullPath = path.join(DIST_DIR, withIndex);

  if (path.extname(fullPath)) {
    return fullPath;
  }

  return path.join(fullPath, "index.html");
}

function watchProject() {
  for (const watchTarget of WATCH_DIRS) {
    if (!fs.existsSync(watchTarget)) {
      continue;
    }

    const isDirectory = fs.statSync(watchTarget).isDirectory();
    const options = isDirectory ? { recursive: true } : undefined;
    fs.watch(watchTarget, options, () => {
      scheduleBuild(`change detected in ${path.basename(watchTarget)}`);
    });
  }
}

await queueBuild("initial build");
watchProject();

http
  .createServer(async (request, response) => {
    try {
      const filePath = resolveRequestPath(request.url || "/");
      const targetPath = fs.existsSync(filePath)
        ? filePath
        : path.join(DIST_DIR, "404.html");
      const body = await fsp.readFile(targetPath);
      response.writeHead(targetPath.endsWith("404.html") ? 404 : 200, {
        "Content-Type": contentType(targetPath),
        "Cache-Control": "no-store"
      });
      response.end(body);
    } catch (error) {
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Dev server error");
      console.error(error);
    }
  })
  .listen(PORT, () => {
    console.log(`Signal Stack dev server running at http://localhost:${PORT}`);
  });
