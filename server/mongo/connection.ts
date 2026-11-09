import mongoose from "mongoose";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { initialProjects } from "../../shared/portfolio";
import { MessageModel, ProjectModel, SettingsModel, UserModel } from "./models";

export type DatabaseMode = "external" | "local-preview" | "unavailable";
let configuredMode: DatabaseMode = "unavailable";
let startup: Promise<void> | undefined;
let localMongo:
  | import("mongodb-memory-server-core").MongoMemoryServer
  | undefined;

export function getDatabaseMode(): DatabaseMode {
  return mongoose.connection.readyState === 1 ? configuredMode : "unavailable";
}

export function isDatabaseAvailable(): boolean {
  return getDatabaseMode() !== "unavailable";
}

async function seedInitialProjects(): Promise<void> {
  // Claim a persistent marker BEFORE inserting. Even if all projects are later
  // deleted, restart cannot recreate them. Existing collections are never seeded.
  const markerId = "portfolio-initial-projects-v1";
  if (await SettingsModel.exists({ _id: markerId })) return;
  try {
    await SettingsModel.create({ _id: markerId, seededAt: new Date() });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      error.code === 11000
    )
      return;
    throw error;
  }
  if ((await ProjectModel.countDocuments({})) === 0) {
    await ProjectModel.bulkWrite(
      initialProjects.map(project => ({
        updateOne: {
          filter: { id: project.id },
          update: { $setOnInsert: project },
          upsert: true,
        },
      }))
    );
  }
  await SettingsModel.updateOne(
    { _id: markerId },
    { $set: { seedCompletedAt: new Date() } }
  );
}

async function connect(): Promise<void> {
  const externalUri = process.env.MONGODB_URI?.trim();
  if (!externalUri && process.env.NODE_ENV !== "development") {
    console.warn(
      "[MongoDB] Not configured; public projects are read-only and submissions/writes are disabled."
    );
    return;
  }
  try {
    let uri = externalUri;
    if (uri) {
      configuredMode = "external";
    } else {
      // Despite the package name, this starts a REAL mongod with persistent
      // WiredTiger files. It is a sandbox-only convenience, not production storage.
      const { MongoMemoryServer } = await import("mongodb-memory-server-core");
      const dbPath = path.resolve(process.cwd(), ".local-mongo");
      await mkdir(dbPath, { recursive: true });
      localMongo = await MongoMemoryServer.create({
        binary: { version: process.env.LOCAL_MONGO_VERSION || "8.0.16" },
        instance: {
          dbPath,
          dbName: "aliportfolio",
          storageEngine: "wiredTiger",
          ip: "127.0.0.1",
        },
      });
      uri = localMongo.getUri("aliportfolio");
      configuredMode = "local-preview";
    }
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 8000,
      connectTimeoutMS: 8000,
      socketTimeoutMS: 10000,
      maxPoolSize: 10,
    });
    // Models disable automatic creation because queries are deliberately not
    // buffered. Create/index only after connect(), including on local restarts.
    await Promise.all([
      ProjectModel.createCollection(),
      MessageModel.createCollection(),
      UserModel.createCollection(),
      SettingsModel.createCollection(),
    ]);
    await Promise.all([
      ProjectModel.createIndexes(),
      MessageModel.createIndexes(),
      UserModel.createIndexes(),
      SettingsModel.createIndexes(),
    ]);
    await seedInitialProjects();
    console.log(`[MongoDB] Connected (${configuredMode}).`);
  } catch (error) {
    // Never log driver errors/connection strings: they can include credentials.
    console.error(
      "[MongoDB] Connection or initialization failed; API is in read-only unavailable mode."
    );
    // Local-only diagnostics contain no user-supplied URI or external credentials.
    if (!externalUri && process.env.NODE_ENV === "development")
      console.error("[MongoDB] Local-preview failure:", error);
    configuredMode = "unavailable";
    await mongoose.disconnect().catch(() => undefined);
    await localMongo
      ?.stop({ doCleanup: false, force: false })
      .catch(() => undefined);
    localMongo = undefined;
  }
}

export function initializeDatabase(): Promise<void> {
  startup ??= connect();
  return startup;
}

export async function closeDatabase(): Promise<void> {
  await mongoose.disconnect();
  // Explicitly preserve WiredTiger files between development restarts.
  await localMongo?.stop({ doCleanup: false, force: false });
  localMongo = undefined;
  configuredMode = "unavailable";
  startup = undefined;
}
