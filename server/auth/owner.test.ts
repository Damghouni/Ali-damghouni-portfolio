import { IncomingMessage, ServerResponse } from "node:http";
import { Socket } from "node:net";
import type { Express, Request } from "express";
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  available: false,
  findUser: vi.fn(),
  updateUser: vi.fn(),
  createProject: vi.fn(),
  createMessage: vi.fn(),
}));
vi.mock("../mongo/connection", () => ({
  isDatabaseAvailable: () => mocks.available,
  getDatabaseMode: () => (mocks.available ? "local-preview" : "unavailable"),
}));
vi.mock("../mongo/models", () => ({
  UserModel: { findOne: mocks.findUser, updateOne: mocks.updateUser },
  ProjectModel: { create: mocks.createProject },
  MessageModel: { create: mocks.createMessage },
}));

import { COOKIE_NAME } from "../../shared/const";
import { sdk } from "../_core/sdk";
import type { TrpcContext } from "../_core/context";
import { adminProcedure, router } from "../_core/trpc";
import { createApp } from "../app";
import { getUserByOpenId, roleForOpenId, upsertUser } from "../db";
import { DEFAULT_OWNER_EMAIL, resolveOwnerRequest } from "./owner";

const secret = "unit-test-owner-signing-key-never-deployed";
const session = {
  openId: "provider-owner",
  appId: "portfolio-test",
  name: "JWT name",
};
const provider = {
  openId: session.openId,
  projectId: session.appId,
  name: "Verified Owner",
  email: DEFAULT_OWNER_EMAIL,
};
const requestFor = (token: string) => ({
  headers: { authorization: `Bearer ${token}` },
});
const signed = async (claims: Record<string, unknown> = session) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MANUS_PROJECT_ID", session.appId);
  vi.stubEnv("MANUS_JWT_SECRET", secret);
  vi.stubEnv("OWNER_OPEN_ID", "");
  vi.stubEnv("PORTFOLIO_OWNER_EMAIL", "");
  mocks.available = false;
  vi.spyOn(sdk, "getUserInfoWithJwt").mockResolvedValue(provider);
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("verified owner authorization", () => {
  it("accepts the exact default provider email bound to the signed openId", async () => {
    const token = await signed();
    await expect(resolveOwnerRequest(requestFor(token), sdk)).resolves.toEqual({
      openId: session.openId,
      name: provider.name,
      email: DEFAULT_OWNER_EMAIL,
      role: "admin",
      verification: "provider",
    });
    expect(sdk.getUserInfoWithJwt).toHaveBeenCalledWith(token);
  });

  it("normalizes only email case and surrounding whitespace", async () => {
    vi.mocked(sdk.getUserInfoWithJwt).mockResolvedValue({
      ...provider,
      email: "  Ali.Damghouni@GMAIL.COM  ",
    });
    await expect(
      resolveOwnerRequest(requestFor(await signed()), sdk)
    ).resolves.toMatchObject({
      email: DEFAULT_OWNER_EMAIL,
    });
  });

  it.each([
    "visitor@example.com",
    "ali.damghouni+owner@gmail.com",
    "alidamghouni@gmail.com",
    "ali.damghouni@gmail.com.evil.example",
    "Ali <ali.damghouni@gmail.com>",
    "",
    null,
  ])("rejects non-exact provider email %s", async email => {
    vi.mocked(sdk.getUserInfoWithJwt).mockResolvedValue({ ...provider, email });
    await expect(
      resolveOwnerRequest(requestFor(await signed()), sdk)
    ).rejects.toMatchObject({ status: 403 });
  });

  it("rejects an owner email returned for a different openId", async () => {
    vi.mocked(sdk.getUserInfoWithJwt).mockResolvedValue({
      ...provider,
      openId: "different-owner",
    });
    await expect(
      resolveOwnerRequest(requestFor(await signed()), sdk)
    ).rejects.toMatchObject({ status: 403 });
  });

  it("fails closed when provider lookup fails", async () => {
    vi.mocked(sdk.getUserInfoWithJwt).mockRejectedValue(
      new Error("provider unavailable")
    );
    await expect(
      resolveOwnerRequest(requestFor(await signed()), sdk)
    ).rejects.toMatchObject({ status: 403 });
  });

  it("fails closed when the provider method is absent", async () => {
    await expect(
      resolveOwnerRequest(requestFor(await signed()), {
        verifySession: sdk.verifySession.bind(sdk),
      } as never)
    ).rejects.toMatchObject({ status: 403 });
  });

  it("does not use JWT or request email/name/role as proof", async () => {
    vi.mocked(sdk.getUserInfoWithJwt).mockResolvedValue({
      ...provider,
      name: "Ali Damghouni",
      email: "visitor@example.com",
      role: "admin",
    } as typeof provider);
    const req = {
      ...requestFor(
        await signed({
          ...session,
          name: "Ali Damghouni",
          email: DEFAULT_OWNER_EMAIL,
          role: "admin",
        })
      ),
      body: {
        name: "Ali Damghouni",
        email: DEFAULT_OWNER_EMAIL,
        role: "admin",
      },
      query: { email: DEFAULT_OWNER_EMAIL, role: "admin" },
    };
    await expect(resolveOwnerRequest(req, sdk)).rejects.toMatchObject({
      status: 403,
    });
  });

  it("does not claim the first authenticated visitor as owner", async () => {
    vi.mocked(sdk.getUserInfoWithJwt).mockResolvedValue({
      ...provider,
      email: "first@example.com",
    });
    await expect(
      resolveOwnerRequest(requestFor(await signed()), sdk)
    ).rejects.toMatchObject({ status: 403 });
    expect(process.env.OWNER_OPEN_ID).toBe("");
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("uses only the configured server email override", async () => {
    vi.stubEnv("PORTFOLIO_OWNER_EMAIL", "  Alternate@Example.COM ");
    const req = requestFor(await signed());
    await expect(resolveOwnerRequest(req, sdk)).rejects.toMatchObject({
      status: 403,
    });
    vi.mocked(sdk.getUserInfoWithJwt).mockResolvedValue({
      ...provider,
      email: "alternate@example.com",
    });
    await expect(resolveOwnerRequest(req, sdk)).resolves.toMatchObject({
      email: "alternate@example.com",
    });
  });

  it("keeps explicit openId authoritative and skips provider lookup for a match", async () => {
    vi.stubEnv("OWNER_OPEN_ID", session.openId);
    vi.mocked(sdk.getUserInfoWithJwt).mockRejectedValue(
      new Error("must not run")
    );
    await expect(
      resolveOwnerRequest(requestFor(await signed()), sdk)
    ).resolves.toMatchObject({ verification: "session" });
    expect(sdk.getUserInfoWithJwt).not.toHaveBeenCalled();
  });

  it("does not let an owner email bypass a different explicit openId", async () => {
    vi.stubEnv("OWNER_OPEN_ID", "pinned-other-owner");
    await expect(
      resolveOwnerRequest(requestFor(await signed()), sdk)
    ).rejects.toMatchObject({ status: 403 });
    expect(sdk.getUserInfoWithJwt).not.toHaveBeenCalled();
  });

  it.each(["", "cron_task"])(
    "rejects cron sessions with owner id config %s",
    async configuredId => {
      vi.stubEnv("OWNER_OPEN_ID", configuredId);
      await expect(
        resolveOwnerRequest(
          requestFor(await signed({ ...session, openId: "cron_task" })),
          sdk
        )
      ).rejects.toMatchObject({ status: 403 });
      expect(sdk.getUserInfoWithJwt).not.toHaveBeenCalled();
    }
  );

  it("rejects provider scheduled-task identities even with a matching email", async () => {
    vi.mocked(sdk.getUserInfoWithJwt).mockResolvedValue({
      ...provider,
      taskUid: "scheduled-task",
    });
    await expect(
      resolveOwnerRequest(requestFor(await signed()), sdk)
    ).rejects.toMatchObject({ status: 403 });
  });

  it("does not remotely resolve an invalid or expired project JWT", async () => {
    const expired = await new SignJWT(session)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1 second ago")
      .sign(new TextEncoder().encode(secret));
    for (const token of [
      "forged",
      expired,
      await signed({ ...session, appId: "another-project" }),
    ]) {
      await expect(
        resolveOwnerRequest(requestFor(token), sdk)
      ).rejects.toMatchObject({ status: 401 });
    }
    expect(sdk.getUserInfoWithJwt).not.toHaveBeenCalled();
  });

  it("prefers the application cookie over a Bearer token and ignores scheduled tickets", async () => {
    const token = await signed();
    await resolveOwnerRequest(
      {
        headers: {
          cookie: `${COOKIE_NAME}=${token}`,
          authorization: "Bearer forged",
        },
      },
      sdk
    );
    expect(sdk.getUserInfoWithJwt).toHaveBeenCalledWith(token);
    await expect(
      resolveOwnerRequest(
        { headers: { cookie: `app_session_id=${token}` } },
        sdk
      )
    ).rejects.toMatchObject({ status: 401 });
  });

  it("refreshes remote identity on each request rather than trusting stale email", async () => {
    const req = requestFor(await signed());
    await resolveOwnerRequest(req, sdk);
    vi.mocked(sdk.getUserInfoWithJwt).mockResolvedValue({
      ...provider,
      email: "changed@example.com",
    });
    await expect(resolveOwnerRequest(req, sdk)).rejects.toMatchObject({
      status: 403,
    });
    expect(sdk.getUserInfoWithJwt).toHaveBeenCalledTimes(2);
  });
});

// Exercise the actual REST router through Node objects, without listen() or a server.
function request(app: Express, method: string, url: string, token: string) {
  return new Promise<{ status: number; body: any }>((resolve, reject) => {
    const socket = new Socket();
    Object.defineProperty(socket, "remoteAddress", { value: "127.0.0.1" });
    const req = new IncomingMessage(socket);
    req.method = method;
    req.url = url;
    req.headers = {
      host: "localhost",
      authorization: `Bearer ${token}`,
      "x-portfolio-request": "1",
    };
    const res = new ServerResponse(req);
    const chunks: Buffer[] = [];
    res.write = ((chunk: string | Buffer) => {
      chunks.push(Buffer.from(chunk));
      return true;
    }) as typeof res.write;
    res.end = ((chunk?: string | Buffer) => {
      if (chunk) chunks.push(Buffer.from(chunk));
      res.emit("finish");
      try {
        resolve({
          status: res.statusCode,
          body: JSON.parse(Buffer.concat(chunks).toString()),
        });
      } catch (error) {
        reject(error);
      }
      socket.destroy();
      return res;
    }) as typeof res.end;
    app(req, res);
    req.push(null);
  });
}

describe("owner REST availability", () => {
  it("returns safe provider email from /api/admin/me with Mongo unavailable", async () => {
    const result = await request(
      createApp(),
      "GET",
      "/api/admin/me",
      await signed()
    );
    expect(result).toEqual({
      status: 200,
      body: {
        user: {
          name: provider.name,
          email: DEFAULT_OWNER_EMAIL,
          role: "admin",
        },
        databaseMode: "unavailable",
      },
    });
    expect(mocks.findUser).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("still returns 503 for actual writes without Mongo", async () => {
    const app = createApp();
    const token = await signed();
    expect(
      await request(app, "POST", "/api/admin/projects", token)
    ).toMatchObject({ status: 503 });
    expect(
      await request(app, "PATCH", "/api/admin/messages/message-1", token)
    ).toMatchObject({ status: 503 });
    expect(mocks.createProject).not.toHaveBeenCalled();
    expect(mocks.createMessage).not.toHaveBeenCalled();
  });
});

const adminRouter = router({
  read: adminProcedure.query(({ ctx }) => ctx.user),
  write: adminProcedure.mutation(() => ({ success: true })),
});
function context(
  token: string,
  overrides: Record<string, unknown> = {},
  header = "1"
): TrpcContext {
  const now = new Date();
  return {
    req: { ...requestFor(token), get: () => header } as unknown as Request,
    res: {} as TrpcContext["res"],
    user: {
      id: 1,
      openId: session.openId,
      name: "Stored name",
      email: "stale@example.com",
      role: "user",
      loginMethod: null,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
      ...overrides,
    },
  };
}
describe("tRPC shared owner gate", () => {
  it("independently verifies the provider and overrides stale display role/email", async () => {
    const user = await adminRouter.createCaller(context(await signed())).read();
    expect(user).toMatchObject({
      email: DEFAULT_OWNER_EMAIL,
      name: provider.name,
      role: "admin",
    });
    expect(sdk.getUserInfoWithJwt).toHaveBeenCalledTimes(1);
  });

  it("rejects a forged admin context without a valid token", async () => {
    await expect(
      adminRouter
        .createCaller(
          context("forged", { role: "admin", email: DEFAULT_OWNER_EMAIL })
        )
        .read()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects a stored admin role/email if remote identity is not the owner", async () => {
    vi.mocked(sdk.getUserInfoWithJwt).mockResolvedValue({
      ...provider,
      email: "visitor@example.com",
    });
    await expect(
      adminRouter
        .createCaller(
          context(await signed(), { role: "admin", email: DEFAULT_OWNER_EMAIL })
        )
        .read()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects context identity mismatches and cron contexts", async () => {
    const token = await signed();
    for (const overrides of [{ openId: "different-user" }, { isCron: true }]) {
      await expect(
        adminRouter.createCaller(context(token, overrides)).read()
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    }
  });

  it("keeps explicit owner id authoritative in tRPC without remote lookup", async () => {
    vi.stubEnv("OWNER_OPEN_ID", session.openId);
    await expect(
      adminRouter.createCaller(context(await signed())).read()
    ).resolves.toMatchObject({ role: "admin" });
    expect(sdk.getUserInfoWithJwt).not.toHaveBeenCalled();
  });

  it("retains the exact mutation request-header requirement", async () => {
    await expect(
      adminRouter.createCaller(context(await signed(), {}, "")).write()
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      adminRouter.createCaller(context(await signed())).write()
    ).resolves.toEqual({ success: true });
  });
});

describe("persisted user display roles", () => {
  it("ignores supplied role and incoming email during upsert", async () => {
    mocks.available = true;
    mocks.updateUser.mockResolvedValue({});
    await upsertUser({
      openId: "visitor",
      role: "admin",
      email: DEFAULT_OWNER_EMAIL,
    });
    expect(mocks.updateUser).toHaveBeenCalledWith(
      { openId: "visitor" },
      expect.objectContaining({
        $set: expect.objectContaining({ role: "user" }),
      }),
      { upsert: true, runValidators: true }
    );
  });

  it("derives display role from persisted provider email, not persisted role flags", async () => {
    mocks.available = true;
    const now = new Date();
    const record = {
      id: 1,
      openId: session.openId,
      email: DEFAULT_OWNER_EMAIL,
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    };
    mocks.findUser.mockReturnValue({ lean: async () => record });
    expect(await getUserByOpenId(session.openId)).toMatchObject({
      role: "admin",
    });
    mocks.findUser.mockReturnValue({
      lean: async () => ({
        ...record,
        email: "visitor@example.com",
        role: "admin",
      }),
    });
    expect(await getUserByOpenId(session.openId)).toMatchObject({
      role: "user",
    });
  });

  it("uses explicit id authority and never labels cron as admin", () => {
    vi.stubEnv("OWNER_OPEN_ID", "pinned");
    expect(roleForOpenId("pinned", "other@example.com")).toBe("admin");
    expect(roleForOpenId("visitor", DEFAULT_OWNER_EMAIL)).toBe("user");
    vi.stubEnv("OWNER_OPEN_ID", "cron_task");
    expect(roleForOpenId("cron_task", DEFAULT_OWNER_EMAIL)).toBe("user");
  });
});
