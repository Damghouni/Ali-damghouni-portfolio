import type {
  ErrorRequestHandler,
  Request,
  RequestHandler,
  Response,
} from "express";
import type { z } from "zod";
import { sdk } from "../_core/sdk";
import { OwnerAuthorizationError, resolveOwnerRequest } from "../auth/owner";
import { isDatabaseAvailable } from "../mongo/connection";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
  }
}

export function asyncRoute(
  handler: (req: Request, res: Response) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    const field = issue?.path.join(".");
    throw new ApiError(
      400,
      field
        ? `Please check ${field}: ${issue.message}`
        : "Please check the submitted fields."
    );
  }
  return result.data;
}

export const requireDatabase: RequestHandler = (_req, _res, next) => {
  if (!isDatabaseAvailable())
    return next(
      new ApiError(
        503,
        "The database is temporarily unavailable. Please try again later."
      )
    );
  next();
};

export const ownerOnly: RequestHandler = (req, res, next) => {
  const authorize = async () => {
    let owner;
    try {
      owner = await resolveOwnerRequest(req, sdk);
    } catch (error) {
      if (error instanceof OwnerAuthorizationError)
        throw new ApiError(error.status, error.message);
      throw error;
    }
    let user = {
      name: owner.name,
      email: owner.email,
      role: "admin" as const,
    };
    // Provider-verified metadata is already safe and works without MongoDB. Only
    // the legacy explicit-id path needs optional persisted display information.
    if (owner.verification === "session" && isDatabaseAvailable()) {
      try {
        const persisted = await sdk.authenticateRequest(req);
        if (persisted.openId !== owner.openId || persisted.isCron)
          throw new ApiError(
            403,
            "Administration is restricted to the portfolio owner."
          );
        user = { name: persisted.name, email: persisted.email, role: "admin" };
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError(
          503,
          "Your account could not be loaded. Please try again shortly."
        );
      }
    }
    res.locals.adminUser = user;
  };
  void authorize().then(() => next(), next);
};

export const requireMutationHeader: RequestHandler = (req, _res, next) => {
  if (
    !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
    req.get("X-Portfolio-Request") !== "1"
  ) {
    return next(
      new ApiError(
        403,
        "This request could not be verified. Please refresh and try again."
      )
    );
  }
  next();
};

export const apiErrorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next
) => {
  if (res.headersSent) {
    _next(error);
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  const metadata =
    typeof error === "object" && error !== null
      ? (error as { type?: string; name?: string; code?: number })
      : {};
  if (metadata.type === "entity.too.large") {
    res.status(413).json({
      error: "This request is too large. Please shorten the submitted content.",
    });
  } else if (
    metadata.type === "entity.parse.failed" ||
    error instanceof SyntaxError
  ) {
    res.status(400).json({
      error: "The request contains invalid JSON. Please check your submission.",
    });
  } else if (metadata.code === 11000) {
    res.status(409).json({
      error: "An item with this identifier already exists. Please try again.",
    });
  } else if (
    ["ValidationError", "CastError", "StrictModeError"].includes(
      metadata.name ?? ""
    )
  ) {
    res
      .status(400)
      .json({ error: "Please check the submitted fields and try again." });
  } else if (
    !isDatabaseAvailable() ||
    [
      "MongoNetworkError",
      "MongoServerSelectionError",
      "MongoNetworkTimeoutError",
    ].includes(metadata.name ?? "")
  ) {
    res.status(503).json({
      error: "The database is temporarily unavailable. Please try again later.",
    });
  } else {
    // Avoid logging contact content, user records, or connection-string secrets.
    console.error("[API] A request could not be completed.");
    res
      .status(500)
      .json({ error: "Something went wrong. Please try again shortly." });
  }
};
