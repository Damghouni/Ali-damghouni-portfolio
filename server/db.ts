import { createHash } from "node:crypto";
import mongoose from "mongoose";
import type { InsertUser, User } from "../drizzle/schema";
import { ownerDisplayRole } from "./auth/owner";
import { isDatabaseAvailable } from "./mongo/connection";
import { UserModel } from "./mongo/models";

/** Legacy helper name retained; the application now uses MongoDB only. */
export async function getDb() {
  return isDatabaseAvailable() ? mongoose.connection : null;
}

/** 52-bit deterministic numeric identity compatible with the starter User type. */
export function stableUserId(openId: string): number {
  return Number.parseInt(
    createHash("sha256").update(openId).digest("hex").slice(0, 13),
    16
  );
}

/** Display only; callers must pass server-persisted provider email, not request/JWT fields. */
export function roleForOpenId(
  openId: string,
  persistedEmail?: string | null
): "user" | "admin" {
  return ownerDisplayRole(openId, persistedEmail);
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (
    typeof user.openId !== "string" ||
    !user.openId ||
    user.openId.length > 256
  ) {
    throw new Error("A valid user identity is required");
  }
  if (!isDatabaseAvailable()) throw new Error("Database is unavailable");
  const values: Record<string, unknown> = {
    // Never honor supplied roles or use an incoming email for promotion. Reads
    // derive display metadata from the persisted provider identity; access checks
    // independently verify the project session and provider identity.
    role: roleForOpenId(user.openId),
    lastSignedIn: user.lastSignedIn ?? new Date(),
  };
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) values[field] = user[field] ?? null;
  }
  await UserModel.updateOne(
    { openId: user.openId },
    {
      $set: values,
      $setOnInsert: { id: stableUserId(user.openId), openId: user.openId },
    },
    { upsert: true, runValidators: true }
  );
}

export async function getUserByOpenId(
  openId: string
): Promise<User | undefined> {
  if (typeof openId !== "string" || !openId || !isDatabaseAvailable())
    return undefined;
  const record = await UserModel.findOne({ openId }).lean();
  if (!record) return undefined;
  return {
    id: record.id,
    openId: record.openId,
    name: record.name ?? null,
    email: record.email ?? null,
    loginMethod: record.loginMethod ?? null,
    role: roleForOpenId(record.openId, record.email),
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    lastSignedIn: record.lastSignedIn,
  };
}
