import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import path from "node:path";

interface StaticRoots {
  dashboardDir: string;
  userClientDir: string;
  webgpuClientDir: string;
}

export async function serveStaticFile(url: URL, response: ServerResponse, roots: StaticRoots): Promise<void> {
  const route = resolveStaticRoute(url, roots);

  if (!isInsideDir(route.filePath, route.baseDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(route.filePath);

    if (!fileStat.isFile()) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": contentType(route.filePath) });
    createReadStream(route.filePath).pipe(response);
  } catch {
    const fallback = await readFile(path.join(route.baseDir, "index.html"));
    response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    response.end(fallback);
  }
}

function resolveStaticRoute(url: URL, roots: StaticRoots) {
  const isUserClient = url.pathname === "/play" || url.pathname.startsWith("/play/");
  const isWebgpuClient = url.pathname === "/webgpu" || url.pathname.startsWith("/webgpu/");
  const baseDir = routeBaseDir(roots, isUserClient, isWebgpuClient);
  const routePath = routeRelativePath(url.pathname, isUserClient, isWebgpuClient);
  const requestedPath = routePath === "" || routePath === "/" ? "/index.html" : routePath;

  return {
    baseDir,
    filePath: path.normalize(path.join(baseDir, requestedPath))
  };
}

function routeBaseDir(roots: StaticRoots, isUserClient: boolean, isWebgpuClient: boolean): string {
  if (isUserClient) return roots.userClientDir;
  if (isWebgpuClient) return roots.webgpuClientDir;
  return roots.dashboardDir;
}

function routeRelativePath(pathname: string, isUserClient: boolean, isWebgpuClient: boolean): string {
  if (isUserClient) return publicAssetPath(pathname.slice("/play".length));
  if (isWebgpuClient) return publicAssetPath(pathname.slice("/webgpu".length));
  return pathname;
}

function publicAssetPath(relativePath: string): string {
  return relativePath.startsWith("/assets/") ? `/public${relativePath}` : relativePath;
}

function isInsideDir(filePath: string, dirPath: string): boolean {
  return filePath === dirPath || filePath.startsWith(`${dirPath}${path.sep}`);
}

function contentType(filePath: string): string {
  const extension = path.extname(filePath);

  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  if (extension === ".mp3") return "audio/mpeg";

  return "application/octet-stream";
}