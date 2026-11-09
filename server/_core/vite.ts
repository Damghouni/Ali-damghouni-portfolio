import express, { type Express } from "express";
import fs from "node:fs";
import type { Server } from "node:http";
import { nanoid } from "nanoid";
import path from "node:path";
import { createServer as createViteServer } from "vite";
import viteConfig from "../../vite.config";
import { renderPortfolio } from "../render";

function pageTemplate(template: string, pathname: string) {
  if (pathname === "/") return template;
  const title =
    pathname === "/admin"
      ? "Portfolio Administration — Ali Damghouni"
      : "Page not found — Ali Damghouni";
  return template
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace(
      /<meta\s+(?:property="og:[^"]*"|name="twitter:[^"]*"|name="description")[^>]*>/g,
      ""
    )
    .replace(
      "</head>",
      '<meta name="robots" content="noindex, nofollow" /></head>'
    )
    .replace(
      '<div id="root"></div>',
      `<div id="root">${pathname === "/admin" ? "" : '<main style="padding:60px;font-family:sans-serif"><h1>Page not found</h1><p>This page does not exist.</p><a href="/">Return to portfolio</a></main>'}</div>`
    );
}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    server: { middlewareMode: true, hmr: { server }, allowedHosts: true },
    appType: "custom",
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    try {
      const pathname = req.originalUrl.split("?")[0];
      let template = await fs.promises.readFile(
        path.resolve(import.meta.dirname, "../..", "client", "index.html"),
        "utf8"
      );
      template = template.replace(
        'src="/src/main.tsx"',
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      template = pageTemplate(template, pathname);
      if (pathname === "/")
        template = template.replace(
          '<div id="root"></div>',
          `<div id="root">${await renderPortfolio()}</div>`
        );
      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res
        .status(["/", "/admin"].includes(pathname) ? 200 : 404)
        .set({ "Content-Type": "text/html", "Cache-Control": "no-store" })
        .end(page);
    } catch (error) {
      vite.ssrFixStacktrace(error as Error);
      next(error);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");
  const shellFile = path.join(distPath, "app-shell.html");
  if (!fs.existsSync(shellFile))
    throw new Error("Missing frontend build; run pnpm build before start.");
  const template = fs.readFileSync(shellFile, "utf8");
  // Only the root page carries portfolio content; private routes remain separate.
  app.get("/", async (_req, res, next) => {
    try {
      res
        .status(200)
        .type("html")
        .set("Cache-Control", "no-store")
        .send(
          template.replace(
            '<div id="root"></div>',
            `<div id="root">${await renderPortfolio()}</div>`
          )
        );
    } catch (error) {
      next(error);
    }
  });
  app.get("/admin", (_req, res) =>
    res
      .status(200)
      .type("html")
      .set("Cache-Control", "private, no-store")
      .send(pageTemplate(template, "/admin"))
  );
  app.use(express.static(distPath, { index: false }));
  app.use("*", (req, res) =>
    res
      .status(404)
      .type("html")
      .set("Cache-Control", "no-store")
      .send(pageTemplate(template, req.originalUrl.split("?")[0]))
  );
}
