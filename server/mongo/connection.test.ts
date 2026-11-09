import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  readyState: 0,
  localCreate: vi.fn(),
  collection: vi.fn(),
  index: vi.fn(),
  exists: vi.fn(),
  settingsCreate: vi.fn(),
  count: vi.fn(),
  bulkWrite: vi.fn(),
  settingsUpdate: vi.fn(),
}));
vi.mock("mongoose", () => ({
  default: {
    connect: mocks.connect,
    disconnect: mocks.disconnect,
    connection: {
      get readyState() {
        return mocks.readyState;
      },
    },
  },
}));
vi.mock("mongodb-memory-server-core", () => ({
  MongoMemoryServer: { create: mocks.localCreate },
}));
vi.mock("./models", () => {
  const initialization = {
    createCollection: mocks.collection,
    createIndexes: mocks.index,
  };
  return {
    ProjectModel: {
      ...initialization,
      countDocuments: mocks.count,
      bulkWrite: mocks.bulkWrite,
    },
    MessageModel: initialization,
    UserModel: initialization,
    SettingsModel: {
      ...initialization,
      exists: mocks.exists,
      create: mocks.settingsCreate,
      updateOne: mocks.settingsUpdate,
    },
  };
});
import {
  closeDatabase,
  getDatabaseMode,
  initializeDatabase,
} from "./connection";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readyState = 0;
  mocks.disconnect.mockImplementation(async () => {
    mocks.readyState = 0;
  });
  mocks.collection.mockResolvedValue({});
  mocks.index.mockResolvedValue({});
  mocks.exists.mockResolvedValue(null);
  mocks.settingsCreate.mockResolvedValue({});
  mocks.count.mockResolvedValue(0);
  mocks.bulkWrite.mockResolvedValue({});
  mocks.settingsUpdate.mockResolvedValue({});
  mocks.connect.mockImplementation(async () => {
    mocks.readyState = 1;
  });
});
afterEach(async () => {
  await closeDatabase();
  vi.unstubAllEnvs();
});

describe("database mode safety", () => {
  it("does not start a local or external database when production has no URI", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONGODB_URI", "");
    await initializeDatabase();
    expect(getDatabaseMode()).toBe("unavailable");
    expect(mocks.localCreate).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
  });
  it("never falls back to local preview after an external connection failure", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("MONGODB_URI", "mongodb://external.example/app");
    mocks.connect.mockRejectedValue(new Error("simulated external failure"));
    await initializeDatabase();
    expect(getDatabaseMode()).toBe("unavailable");
    expect(mocks.localCreate).not.toHaveBeenCalled();
    expect(mocks.disconnect).toHaveBeenCalled();
  });
  it("uses the external database and seeds only an initially empty collection", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONGODB_URI", "mongodb://external.example/app");
    await initializeDatabase();
    expect(getDatabaseMode()).toBe("external");
    expect(mocks.localCreate).not.toHaveBeenCalled();
    expect(mocks.bulkWrite).toHaveBeenCalledTimes(1);
    expect(mocks.settingsCreate.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.bulkWrite.mock.invocationCallOrder[0]
    );
    expect(mocks.bulkWrite.mock.calls[0][0][0]).toMatchObject({
      updateOne: {
        filter: { id: "amieroute" },
        update: { $setOnInsert: { id: "amieroute" } },
        upsert: true,
      },
    });
  });
  it("does not seed an existing nonempty collection", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONGODB_URI", "mongodb://external.example/app");
    mocks.count.mockResolvedValue(1);
    await initializeDatabase();
    expect(mocks.bulkWrite).not.toHaveBeenCalled();
    expect(mocks.settingsCreate).toHaveBeenCalledTimes(1);
  });
  it("does not seed an empty collection again when the persistent marker exists", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MONGODB_URI", "mongodb://external.example/app");
    mocks.exists.mockResolvedValue({ _id: "portfolio-initial-projects-v1" });
    await initializeDatabase();
    expect(mocks.bulkWrite).not.toHaveBeenCalled();
    expect(mocks.settingsCreate).not.toHaveBeenCalled();
  });
});
