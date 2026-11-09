import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import fs from "node:fs/promises";
import Home from "../client/src/pages/Home";
import { initialProjects } from "../shared/portfolio";

const queryClient = new QueryClient();
queryClient.setQueryData(["projects"], { projects: initialProjects });
const html = renderToStaticMarkup(
  <QueryClientProvider client={queryClient}>
    <Router ssrPath="/">
      <Home />
    </Router>
  </QueryClientProvider>
);
const file = "dist/public/index.html";
const template = await fs.readFile(file, "utf8");
await fs.writeFile("dist/public/app-shell.html", template);
await fs.writeFile(
  file,
  template.replace('<div id="root"></div>', `<div id="root">${html}</div>`)
);
console.log("Prerendered public portfolio content for search engines.");
