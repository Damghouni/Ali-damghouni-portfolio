import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { initialProjects } from "../../shared/portfolio";
import { getUserByOpenId, upsertUser } from "../db";
import {
  closeDatabase,
  getDatabaseMode,
  initializeDatabase,
} from "./connection";
import { MessageModel, ProjectModel, SettingsModel, UserModel } from "./models";

const enabled = process.env.RUN_LOCAL_MONGO_TESTS === "1";
describe.runIf(enabled)("isolated real local MongoDB integration", () => {
  let directory: string;
  beforeAll(async () => {
    // Never connect/write to an external database, even if the session supplies one.
    vi.stubEnv("MONGODB_URI", "");
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OWNER_OPEN_ID", "integration-owner");
    directory = await mkdtemp(
      path.join(os.tmpdir(), "aliportfolio-mongo-test-")
    );
    vi.spyOn(process, "cwd").mockReturnValue(directory);
    await initializeDatabase();
    expect(getDatabaseMode()).toBe("local-preview");
  }, 240000);
  afterAll(async () => {
    await closeDatabase();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    if (directory) await rm(directory, { recursive: true, force: true });
  }, 30000);

  it("seeds known stable ids once without replacing edited projects on restart", async () => {
    expect(await ProjectModel.countDocuments({})).toBe(initialProjects.length);
    expect(await SettingsModel.countDocuments({})).toBe(1);
    await ProjectModel.updateOne(
      { id: "amieroute" },
      { $set: { title: "Owner edit" } }
    );
    await closeDatabase();
    await initializeDatabase();
    expect(getDatabaseMode()).toBe("local-preview");
    expect(
      (await ProjectModel.findOne({ id: "amieroute" }).lean())?.title
    ).toBe("Owner edit");
  }, 60000);

  it("never resurrects deleted seed projects after restart, even an empty collection", async () => {
    await ProjectModel.deleteMany({});
    await closeDatabase();
    await initializeDatabase();
    expect(await ProjectModel.countDocuments({})).toBe(0);
    expect(await SettingsModel.countDocuments({})).toBe(1);
  }, 60000);

  it("persists real contacts and status edits across a restart", async () => {
    await MessageModel.create({
      id: "integration-message",
      name: "Test Sender",
      email: "sender@example.com",
      subject: "Project inquiry",
      message: "A test message in an isolated local database.",
      status: "unread",
    });
    await MessageModel.updateOne(
      { id: "integration-message" },
      { $set: { status: "read" } },
      { runValidators: true }
    );
    await closeDatabase();
    await initializeDatabase();
    expect(
      (await MessageModel.findOne({ id: "integration-message" }).lean())?.status
    ).toBe("read");
  }, 60000);

  it("preserves numeric starter user ids and enforces owner-only roles", async () => {
    await upsertUser({ openId: "integration-owner", name: "Owner" });
    await upsertUser({
      openId: "integration-visitor",
      name: "Visitor",
      role: "admin",
    });
    const owner = await getUserByOpenId("integration-owner");
    expect(owner?.role).toBe("admin");
    expect(Number.isSafeInteger(owner?.id)).toBe(true);
    expect((await getUserByOpenId("integration-visitor"))?.role).toBe("user");
    await upsertUser({ openId: "integration-owner", lastSignedIn: new Date() });
    expect((await getUserByOpenId("integration-owner"))?.id).toBe(owner?.id);
    expect(await UserModel.countDocuments({})).toBe(2);
  });

  it("rejects unknown fields and invalid schema values", async () => {
    // @ts-expect-error Deliberately simulate untyped HTTP input containing an unknown field.
    await expect(
      MessageModel.create({
        id: "bad",
        name: "Test",
        email: "a@example.com",
        subject: "Hi",
        message: "Long enough message",
        status: "unread",
        unauthorizedField: "no",
      })
    ).rejects.toThrow();
    await expect(
      MessageModel.updateOne(
        { id: "integration-message" },
        { $set: { status: "invalid" } },
        { runValidators: true }
      )
    ).rejects.toThrow();
  });
});
