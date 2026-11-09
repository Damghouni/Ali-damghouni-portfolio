import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from "@shared/const";
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { OwnerAuthorizationError, resolveOwnerRequest } from "../auth/owner";
import type { TrpcContext } from "./context";
import { sdk } from "./sdk";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    let owner;
    try {
      owner = await resolveOwnerRequest(ctx.req, sdk);
    } catch (error) {
      if (error instanceof OwnerAuthorizationError)
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      throw error;
    }
    if (
      !ctx.user ||
      ctx.user.openId !== owner.openId ||
      (ctx.user as { isCron?: boolean }).isCron
    ) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    if (
      opts.type === "mutation" &&
      ctx.req.get("X-Portfolio-Request") !== "1"
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "This request could not be verified.",
      });
    }

    return next({
      ctx: {
        ...ctx,
        user: {
          ...ctx.user,
          // Stored display metadata cannot override a freshly verified provider identity.
          ...(owner.verification === "provider"
            ? { name: owner.name, email: owner.email }
            : {}),
          role: "admin" as const,
        },
      },
    });
  })
);
