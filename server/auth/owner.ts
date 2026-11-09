import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { COOKIE_NAME } from "../../shared/const";
import { ENV } from "../_core/env";
import type { sdk } from "../_core/sdk";

export const DEFAULT_OWNER_EMAIL = "ali.damghouni@gmail.com";

/** Exact comparison after case/whitespace normalization; no alias rewriting. */
export function normalizeOwnerEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

/** Server configuration only: request fields and JWT email claims are never read. */
export function configuredOwnerEmail(): string {
  return (
    normalizeOwnerEmail(process.env.PORTFOLIO_OWNER_EMAIL) ||
    DEFAULT_OWNER_EMAIL
  );
}

/** Display metadata only. A persisted email is not an authorization credential. */
export function ownerDisplayRole(
  openId: string,
  persistedEmail?: string | null
): "user" | "admin" {
  if (!openId || openId.startsWith("cron_")) return "user";
  if (ENV.ownerOpenId) return openId === ENV.ownerOpenId ? "admin" : "user";
  return normalizeOwnerEmail(persistedEmail) === configuredOwnerEmail()
    ? "admin"
    : "user";
}

export class OwnerAuthorizationError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(
      status === 401
        ? "Please sign in to access administration."
        : "Administration is restricted to the portfolio owner."
    );
  }
}

export type OwnerIdentity = {
  openId: string;
  name: string | null;
  email: string | null;
  role: "admin";
  verification: "session" | "provider";
};

type OwnerSdk = Pick<typeof sdk, "verifySession" | "getUserInfoWithJwt">;

/** Use the same cookie/Bearer precedence as the SDK; scheduled tickets cannot authorize. */
export function ownerRequestToken(
  req: Pick<Request, "headers">
): string | undefined {
  const cookies = parseCookieHeader(req.headers.cookie ?? "");
  const authorization = req.headers.authorization;
  return (
    cookies[COOKIE_NAME] ||
    (authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined)
  );
}

/**
 * Always verify the project's exp/HS256/app-bound JWT first. An explicitly pinned
 * openId is authoritative. Otherwise resolve the provider identity on every request;
 * neither stored roles/emails nor JWT/request names/emails can authorize an owner.
 * The SDK is injected to avoid a runtime dependency cycle with user persistence.
 */
export async function resolveOwnerRequest(
  req: Pick<Request, "headers">,
  auth: OwnerSdk
): Promise<OwnerIdentity> {
  const token = ownerRequestToken(req);
  const session = await auth.verifySession(token);
  if (!session || !token) throw new OwnerAuthorizationError(401);
  if (session.openId.startsWith("cron_"))
    throw new OwnerAuthorizationError(403);

  if (ENV.ownerOpenId) {
    if (session.openId !== ENV.ownerOpenId)
      throw new OwnerAuthorizationError(403);
    return {
      openId: session.openId,
      name: session.name || null,
      email: null,
      role: "admin",
      verification: "session",
    };
  }

  try {
    // Missing provider functionality/configuration, malformed responses, and lookup
    // failures all fail closed, including older mocks with only verifySession.
    if (typeof auth.getUserInfoWithJwt !== "function") {
      throw new OwnerAuthorizationError(403);
    }
    const identity = await auth.getUserInfoWithJwt(token);
    const email = normalizeOwnerEmail(identity?.email);
    if (
      !identity ||
      identity.openId !== session.openId ||
      identity.openId.startsWith("cron_") ||
      identity.taskUid ||
      (identity as { isCron?: boolean }).isCron ||
      email !== configuredOwnerEmail()
    ) {
      throw new OwnerAuthorizationError(403);
    }
    return {
      openId: identity.openId,
      name: typeof identity.name === "string" ? identity.name || null : null,
      email,
      role: "admin",
      verification: "provider",
    };
  } catch {
    throw new OwnerAuthorizationError(403);
  }
}
