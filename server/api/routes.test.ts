import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialProjects } from "../../shared/portfolio";

const mocks = vi.hoisted(() => ({
  mode: "local-preview" as "local-preview" | "external" | "unavailable",
  verify: vi.fn(),
  authenticate: vi.fn(),
  projectFind: vi.fn(),
  projectCreate: vi.fn(),
  projectUpdate: vi.fn(),
  projectDelete: vi.fn(),
  messageFind: vi.fn(),
  messageCreate: vi.fn(),
  messageUpdate: vi.fn(),
  messageDelete: vi.fn(),
}));
vi.mock("../mongo/connection", () => ({
  getDatabaseMode: () => mocks.mode,
  isDatabaseAvailable: () => mocks.mode !== "unavailable",
}));
vi.mock("../mongo/models", () => ({
  ProjectModel: {
    find: mocks.projectFind,
    create: mocks.projectCreate,
    findOneAndUpdate: mocks.projectUpdate,
    deleteOne: mocks.projectDelete,
  },
  MessageModel: {
    find: mocks.messageFind,
    create: mocks.messageCreate,
    findOneAndUpdate: mocks.messageUpdate,
    deleteOne: mocks.messageDelete,
  },
}));
vi.mock("../_core/sdk", () => ({
  sdk: { verifySession: mocks.verify, authenticateRequest: mocks.authenticate },
}));
import { createApp } from "../app";

// Drive Express through Node request/response objects without listen() or a port.
function request(
  app: Express,
  method: string,
  url: string,
  body?: unknown,
  headers: Record<string, string> = {}
) {
  return new Promise<{
    status: number;
    body: any;
    headers: ReturnType<ServerResponse["getHeaders"]>;
  }>((resolve, reject) => {
    const socket = new Socket();
    Object.defineProperty(socket, "remoteAddress", { value: "127.0.0.1" });
    const req = new IncomingMessage(socket);
    const text = body === undefined ? "" : JSON.stringify(body);
    req.method = method;
    req.url = url;
    req.headers = {
      host: "localhost",
      ...headers,
      ...(body === undefined
        ? {}
        : {
            "content-type": "application/json",
            "content-length": String(Buffer.byteLength(text)),
          }),
    };
    const res = new ServerResponse(req);
    const chunks: Buffer[] = [];
    res.write = ((chunk: string | Buffer) => {
      chunks.push(Buffer.from(chunk));
      return true;
    }) as typeof res.write;
    res.end = ((chunk?: string | Buffer) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      const data = Buffer.concat(chunks).toString();
      res.emit("finish");
      try {
        resolve({
          status: res.statusCode,
          body: data ? JSON.parse(data) : null,
          headers: res.getHeaders(),
        });
      } catch (error) {
        reject(error);
      }
      socket.destroy();
      return res;
    }) as typeof res.end;
    app(req, res);
    if (text) req.push(text);
    req.push(null);
  });
}
const session = { openId: "owner", appId: "test", name: "Owner" };
const user = { ...session, email: "owner@example.com", role: "admin" };
const adminHeaders = {
  authorization: "Bearer valid",
  "x-portfolio-request": "1",
};
const contact = {
  name: "Ali D",
  email: "ali@example.com",
  subject: "A project",
  message: "Let's discuss a new project together.",
  website: "",
};
const { id: _id, ...project } = initialProjects[0];
let app: Express;
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("OWNER_OPEN_ID", "owner");
  mocks.mode = "local-preview";
  mocks.verify.mockResolvedValue(null);
  mocks.authenticate.mockResolvedValue(user);
  app = createApp();
});
afterEach(() => vi.unstubAllEnvs());

describe("API security and availability", () => {
  it("reports safe database health and has no permissive CORS or frame blocker", async () => {
    const result = await request(app, "GET", "/api/health");
    expect(result.status).toBe(200);
    expect(result.body).toEqual({
      status: "ok",
      database: "connected",
      databaseMode: "local-preview",
    });
    expect(result.headers["x-powered-by"]).toBeUndefined();
    expect(result.headers["x-frame-options"]).toBeUndefined();
    expect(result.headers["content-security-policy"]).toBeUndefined();
    expect(result.headers["access-control-allow-origin"]).toBeUndefined();
    expect(result.headers["cache-control"]).toBe("no-store");
  });
  it("clears the secure application cookie without needing a live owner session", async () => {
    const result = await request(app, "POST", "/api/admin/logout", undefined, {
      "x-portfolio-request": "1",
    });
    expect(result).toMatchObject({ status: 200, body: { success: true } });
    const cookies = String(result.headers["set-cookie"]);
    expect(cookies).toContain("webdev_app_session=");
    expect(cookies).toContain("HttpOnly");
    expect(cookies).toContain("Secure");
    expect(cookies).toContain("SameSite=None");
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });
  it("rejects cross-origin-style sign-out without the request header", async () => {
    expect(await request(app, "POST", "/api/admin/logout")).toMatchObject({
      status: 403,
    });
  });
  it("returns a JSON 404 rather than SPA HTML for an unknown API", async () => {
    expect(await request(app, "GET", "/api/missing")).toMatchObject({
      status: 404,
      body: { error: expect.any(String) },
    });
  });
  it("requires authentication for administration", async () => {
    expect(await request(app, "GET", "/api/admin/me")).toMatchObject({
      status: 401,
      body: { error: expect.any(String) },
    });
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });
  it("rejects a non-owner even if persistence reports admin", async () => {
    mocks.verify.mockResolvedValue({ ...session, openId: "visitor" });
    expect(
      await request(app, "GET", "/api/admin/me", undefined, adminHeaders)
    ).toMatchObject({ status: 403 });
    expect(mocks.authenticate).not.toHaveBeenCalled();
  });
  it("never promotes anyone when the owner identity is not configured", async () => {
    vi.stubEnv("OWNER_OPEN_ID", "");
    mocks.verify.mockResolvedValue(session);
    expect(
      await request(app, "GET", "/api/admin/me", undefined, adminHeaders)
    ).toMatchObject({ status: 403 });
  });
  it("returns only safe user fields to the authenticated owner", async () => {
    mocks.verify.mockResolvedValue(session);
    const result = await request(
      app,
      "GET",
      "/api/admin/me",
      undefined,
      adminHeaders
    );
    expect(result).toMatchObject({
      status: 200,
      body: {
        user: { name: "Owner", email: "owner@example.com", role: "admin" },
        databaseMode: "local-preview",
      },
    });
    expect(Object.keys(result.body.user).sort()).toEqual([
      "email",
      "name",
      "role",
    ]);
  });
  it("requires the exact custom header on admin writes", async () => {
    mocks.verify.mockResolvedValue(session);
    expect(
      await request(app, "POST", "/api/admin/projects", project, {
        authorization: "Bearer valid",
      })
    ).toMatchObject({ status: 403 });
    expect(mocks.projectCreate).not.toHaveBeenCalled();
  });
  it("supports read-only static projects and owner me when Mongo is unavailable", async () => {
    mocks.mode = "unavailable";
    mocks.verify.mockResolvedValue(session);
    expect(await request(app, "GET", "/api/projects")).toMatchObject({
      status: 200,
      body: { projects: initialProjects, databaseMode: "unavailable" },
    });
    expect(
      await request(app, "GET", "/api/admin/me", undefined, adminHeaders)
    ).toMatchObject({ status: 200, body: { databaseMode: "unavailable" } });
    expect(await request(app, "POST", "/api/contact", contact)).toMatchObject({
      status: 503,
    });
    expect(
      await request(app, "POST", "/api/admin/projects", project, adminHeaders)
    ).toMatchObject({ status: 503 });
    expect(mocks.projectCreate).not.toHaveBeenCalled();
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });
  it("rejects oversized requests before an insert", async () => {
    expect(
      await request(app, "POST", "/api/contact", {
        ...contact,
        message: "x".repeat(40000),
      })
    ).toMatchObject({ status: 413 });
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });
});

describe("persistent contact API", () => {
  it("returns 201 only after a successful database insert", async () => {
    mocks.messageCreate.mockResolvedValue({});
    expect(await request(app, "POST", "/api/contact", contact)).toMatchObject({
      status: 201,
      body: { success: true },
    });
    expect(mocks.messageCreate).toHaveBeenCalledWith({
      name: contact.name,
      email: contact.email,
      subject: contact.subject,
      message: contact.message,
      status: "unread",
      id: expect.any(String),
    });
  });
  it("does not pretend delivery if the insert fails", async () => {
    mocks.messageCreate.mockRejectedValue({ name: "MongoNetworkError" });
    expect(await request(app, "POST", "/api/contact", contact)).toMatchObject({
      status: 503,
      body: { error: expect.any(String) },
    });
  });
  it("rejects a filled honeypot without storing it", async () => {
    expect(
      await request(app, "POST", "/api/contact", {
        ...contact,
        website: "spam.example",
      })
    ).toMatchObject({ status: 400 });
    expect(mocks.messageCreate).not.toHaveBeenCalled();
  });
  it("rate limits contact more strictly", async () => {
    mocks.messageCreate.mockResolvedValue({});
    for (let i = 0; i < 5; i++)
      expect((await request(app, "POST", "/api/contact", contact)).status).toBe(
        201
      );
    expect(await request(app, "POST", "/api/contact", contact)).toMatchObject({
      status: 429,
      body: { error: expect.any(String) },
    });
  });
});

describe("project and message CRUD", () => {
  beforeEach(() => mocks.verify.mockResolvedValue(session));
  it("queries only published projects ordered by order/id", async () => {
    const sort = vi
      .fn()
      .mockReturnValue({ lean: vi.fn().mockResolvedValue(initialProjects) });
    mocks.projectFind.mockReturnValue({ sort });
    expect(await request(app, "GET", "/api/projects")).toMatchObject({
      status: 200,
      body: { projects: initialProjects },
    });
    expect(mocks.projectFind).toHaveBeenCalledWith({ published: true });
    expect(sort).toHaveBeenCalledWith({ order: 1, id: 1 });
  });
  it("lists all projects including drafts for the owner", async () => {
    const draft = { ...initialProjects[0], published: false };
    mocks.projectFind.mockReturnValue({
      sort: () => ({ lean: async () => [draft] }),
    });
    expect(
      await request(app, "GET", "/api/admin/projects", undefined, adminHeaders)
    ).toMatchObject({ status: 200, body: { projects: [draft] } });
    expect(mocks.projectFind).toHaveBeenCalledWith({});
  });
  it("creates a project with a generated string id and no user filters", async () => {
    mocks.projectCreate.mockImplementation(async input => input);
    const result = await request(
      app,
      "POST",
      "/api/admin/projects",
      project,
      adminHeaders
    );
    expect(result).toMatchObject({
      status: 201,
      body: { project: { ...project, id: expect.any(String) } },
    });
    expect(mocks.projectCreate).toHaveBeenCalledWith({
      ...project,
      id: expect.any(String),
    });
  });
  it("updates through a fixed id filter and rejects changed ids", async () => {
    mocks.projectUpdate.mockReturnValue({
      lean: async () => initialProjects[0],
    });
    expect(
      await request(
        app,
        "PUT",
        "/api/admin/projects/amieroute",
        { ...project, id: "amieroute" },
        adminHeaders
      )
    ).toMatchObject({ status: 200 });
    expect(mocks.projectUpdate).toHaveBeenCalledWith(
      { id: "amieroute" },
      { $set: project },
      { new: true, runValidators: true }
    );
    expect(
      await request(
        app,
        "PUT",
        "/api/admin/projects/amieroute",
        { ...project, id: "different" },
        adminHeaders
      )
    ).toMatchObject({ status: 400 });
  });
  it("returns 404 when a project is absent, and success for an actual deletion", async () => {
    mocks.projectDelete
      .mockResolvedValueOnce({ deletedCount: 0 })
      .mockResolvedValueOnce({ deletedCount: 1 });
    expect(
      await request(
        app,
        "DELETE",
        "/api/admin/projects/missing",
        undefined,
        adminHeaders
      )
    ).toMatchObject({ status: 404 });
    expect(
      await request(
        app,
        "DELETE",
        "/api/admin/projects/amieroute",
        undefined,
        adminHeaders
      )
    ).toMatchObject({ status: 200, body: { success: true } });
  });
  it("lists newest messages and updates/deletes using fixed filters", async () => {
    const record = {
      ...contact,
      id: "message-1",
      status: "read",
      createdAt: new Date("2026-01-01"),
      updatedAt: new Date(),
    };
    const sort = vi.fn().mockReturnValue({ lean: async () => [record] });
    mocks.messageFind.mockReturnValue({ sort });
    const result = await request(
      app,
      "GET",
      "/api/admin/messages",
      undefined,
      adminHeaders
    );
    expect(result).toMatchObject({
      status: 200,
      body: {
        messages: [{ id: "message-1", createdAt: "2026-01-01T00:00:00.000Z" }],
      },
    });
    expect(result.body.messages[0]).not.toHaveProperty("website");
    expect(sort).toHaveBeenCalledWith({ createdAt: -1, id: 1 });
    mocks.messageUpdate.mockReturnValue({ lean: async () => record });
    expect(
      await request(
        app,
        "PATCH",
        "/api/admin/messages/message-1",
        { status: "read" },
        adminHeaders
      )
    ).toMatchObject({ status: 200, body: { message: { status: "read" } } });
    expect(mocks.messageUpdate).toHaveBeenCalledWith(
      { id: "message-1" },
      { $set: { status: "read" } },
      { new: true, runValidators: true }
    );
    mocks.messageDelete.mockResolvedValue({ deletedCount: 1 });
    expect(
      await request(
        app,
        "DELETE",
        "/api/admin/messages/message-1",
        undefined,
        adminHeaders
      )
    ).toMatchObject({ status: 200, body: { success: true } });
  });
});
