import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Router } from "wouter";
import Home from "../client/src/pages/Home";
import { initialProjects } from "../shared/portfolio";
import { ProjectModel } from "./mongo/models";
import { isDatabaseAvailable } from "./mongo/connection";

export async function renderPortfolio(): Promise<string> {
  let projects = initialProjects.filter(p => p.published);
  if (isDatabaseAvailable()) {
    try {
      projects = await ProjectModel.find({ published: true })
        .sort({ order: 1, id: 1 })
        .lean();
    } catch {
      console.warn(
        "[Render] Could not load current projects; showing initial public content."
      );
    }
  }
  const cache = new QueryClient();
  cache.setQueryData(["projects"], { projects });
  return renderToStaticMarkup(
    <QueryClientProvider client={cache}>
      <Router ssrPath="/">
        <Home />
      </Router>
    </QueryClientProvider>
  );
}
