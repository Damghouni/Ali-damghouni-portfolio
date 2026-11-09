import { randomUUID } from "node:crypto";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { COOKIE_NAME } from "../../shared/const";
import { getSessionCookieOptions } from "../_core/cookies";
import {
  initialProjects,
  type ContactMessage,
  type PortfolioProject,
} from "../../shared/portfolio";
import { getDatabaseMode, isDatabaseAvailable } from "../mongo/connection";
import {
  MessageModel,
  ProjectModel,
  type MessageRecord,
} from "../mongo/models";
import {
  ApiError,
  asyncRoute,
  ownerOnly,
  requireDatabase,
  requireMutationHeader,
  validate,
} from "./middleware";
import {
  contactSchema,
  idSchema,
  messageStatusSchema,
  projectSchema,
  updateProjectSchema,
} from "./validation";

function serializeProject(project: PortfolioProject): PortfolioProject {
  return {
    id: project.id,
    title: project.title,
    subtitle: project.subtitle,
    description: project.description,
    category: project.category,
    year: project.year,
    technologies: [...project.technologies],
    status: project.status,
    featured: project.featured,
    published: project.published,
    cover: project.cover,
    imageUrl: project.imageUrl,
    githubUrl: project.githubUrl,
    liveUrl: project.liveUrl,
    highlights: [...project.highlights],
    order: project.order,
  };
}
function serializeMessage(message: MessageRecord): ContactMessage {
  return {
    id: message.id,
    name: message.name,
    email: message.email,
    subject: message.subject,
    message: message.message,
    status: message.status,
    createdAt: message.createdAt.toISOString(),
  };
}

export function createPortfolioRouter(): Router {
  const router = Router();
  router.get("/health", (_req, res) => {
    res.set("Cache-Control", "no-store").json({
      status: "ok",
      databaseMode: getDatabaseMode(),
      database: isDatabaseAvailable() ? "connected" : "unavailable",
    });
  });
  router.get(
    "/projects",
    asyncRoute(async (_req, res) => {
      res.set("Cache-Control", "no-store");
      if (!isDatabaseAvailable()) {
        const projects = initialProjects
          .filter(project => project.published)
          .slice()
          .sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
        res.json({ projects, databaseMode: "unavailable" });
        return;
      }
      const projects = await ProjectModel.find({ published: true })
        .sort({ order: 1, id: 1 })
        .lean();
      res.json({
        projects: projects.map(serializeProject),
        databaseMode: getDatabaseMode(),
      });
    })
  );
  router.post(
    "/contact",
    rateLimit({
      windowMs: 15 * 60 * 1000,
      limit: 5,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: {
        error:
          "Too many submissions. Please wait 15 minutes before trying again.",
      },
    }),
    requireDatabase,
    asyncRoute(async (req, res) => {
      res.set("Cache-Control", "no-store");
      const { website: _honeypot, ...input } = validate(
        contactSchema,
        req.body
      );
      await MessageModel.create({
        ...input,
        id: randomUUID(),
        status: "unread",
      });
      // This means MongoDB stored the message. No email delivery is claimed.
      res.status(201).json({ success: true });
    })
  );

  // Signing out must also work for expired or non-owner sessions. The custom
  // request header prevents cross-origin logout without requiring a valid role.
  router.post("/admin/logout", requireMutationHeader, (req, res) => {
    res.set("Cache-Control", "no-store");
    res.clearCookie(COOKIE_NAME, getSessionCookieOptions(req));
    res.json({ success: true });
  });

  router.use(
    "/admin",
    (_req, res, next) => {
      res.set("Cache-Control", "no-store");
      next();
    },
    ownerOnly,
    requireMutationHeader
  );
  router.get("/admin/me", (_req, res) =>
    res.json({ user: res.locals.adminUser, databaseMode: getDatabaseMode() })
  );
  router.use("/admin/projects", requireDatabase);
  router.get(
    "/admin/projects",
    asyncRoute(async (_req, res) => {
      const projects = await ProjectModel.find({})
        .sort({ order: 1, id: 1 })
        .lean();
      res.json({ projects: projects.map(serializeProject) });
    })
  );
  router.post(
    "/admin/projects",
    asyncRoute(async (req, res) => {
      const input = validate(projectSchema, req.body);
      const project = await ProjectModel.create({ ...input, id: randomUUID() });
      res.status(201).json({ project: serializeProject(project) });
    })
  );
  router.put(
    "/admin/projects/:id",
    asyncRoute(async (req, res) => {
      const id = validate(idSchema, req.params.id);
      const { id: bodyId, ...input } = validate(updateProjectSchema, req.body);
      if (bodyId !== undefined && bodyId !== id)
        throw new ApiError(400, "The project identifier cannot be changed.");
      const project = await ProjectModel.findOneAndUpdate(
        { id },
        { $set: input },
        { new: true, runValidators: true }
      ).lean();
      if (!project) throw new ApiError(404, "This project could not be found.");
      res.json({ project: serializeProject(project) });
    })
  );
  router.delete(
    "/admin/projects/:id",
    asyncRoute(async (req, res) => {
      const id = validate(idSchema, req.params.id);
      const result = await ProjectModel.deleteOne({ id });
      if (!result.deletedCount)
        throw new ApiError(404, "This project could not be found.");
      res.json({ success: true });
    })
  );

  router.use("/admin/messages", requireDatabase);
  router.get(
    "/admin/messages",
    asyncRoute(async (_req, res) => {
      const messages = await MessageModel.find({})
        .sort({ createdAt: -1, id: 1 })
        .lean();
      res.json({ messages: messages.map(serializeMessage) });
    })
  );
  router.patch(
    "/admin/messages/:id",
    asyncRoute(async (req, res) => {
      const id = validate(idSchema, req.params.id);
      const input = validate(messageStatusSchema, req.body);
      const message = await MessageModel.findOneAndUpdate(
        { id },
        { $set: input },
        { new: true, runValidators: true }
      ).lean();
      if (!message) throw new ApiError(404, "This message could not be found.");
      res.json({ message: serializeMessage(message) });
    })
  );
  router.delete(
    "/admin/messages/:id",
    asyncRoute(async (req, res) => {
      const id = validate(idSchema, req.params.id);
      const result = await MessageModel.deleteOne({ id });
      if (!result.deletedCount)
        throw new ApiError(404, "This message could not be found.");
      res.json({ success: true });
    })
  );
  return router;
}
