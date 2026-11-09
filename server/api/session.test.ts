import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sdk } from "../_core/sdk";

const secret = "test-key-for-session-tests-only";
beforeEach(() => {
  vi.stubEnv("MANUS_PROJECT_ID", "portfolio-test");
  vi.stubEnv("MANUS_JWT_SECRET", secret);
});
afterEach(() => vi.unstubAllEnvs());
const payload = { openId: "owner", appId: "portfolio-test", name: "Owner" };
const sign = (jwt: SignJWT) =>
  jwt
    .setProtectedHeader({ alg: "HS256" })
    .sign(new TextEncoder().encode(secret));

describe("project session verification", () => {
  it("rejects a signed JWT without expiry", async () => {
    expect(
      await sdk.verifySession(await sign(new SignJWT(payload)))
    ).toBeNull();
  });
  it("rejects an expired signed JWT", async () => {
    expect(
      await sdk.verifySession(
        await sign(new SignJWT(payload).setExpirationTime("1 second ago"))
      )
    ).toBeNull();
  });
  it("rejects sessions signed by another key", async () => {
    const token = await new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode("other-key"));
    expect(await sdk.verifySession(token)).toBeNull();
  });
  it("rejects tokens for another project", async () => {
    expect(
      await sdk.verifySession(
        await sign(
          new SignJWT({ ...payload, appId: "other" }).setExpirationTime("1h")
        )
      )
    ).toBeNull();
  });
  it("accepts a current project JWT with a valid expiry", async () => {
    expect(
      await sdk.verifySession(
        await sign(new SignJWT(payload).setExpirationTime("1h"))
      )
    ).toEqual(payload);
  });
});
