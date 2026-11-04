import {Prisma} from "@prisma/client";
import {ZodError} from "zod";

export function notFoundHandler(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.path}`);
  error.status = 404;
  error.code = "NOT_FOUND";
  next(error);
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: error.issues.map(issue => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const status = error.code === "P2025" ? 404
      : ["P2002", "P2003", "P2014", "P2034"].includes(error.code) ? 409
        : 400;
    res.status(status).json({
      success: false,
      error: {
        code: error.code,
        message: status === 404 ? "Requested record was not found"
          : status === 409 ? "The change conflicts with existing data"
            : "Database request could not be completed",
      },
    });
    return;
  }

  if (error.type === "entity.parse.failed") {
    res.status(400).json({
      success: false,
      error: {code: "INVALID_JSON", message: "Request body must contain valid JSON"},
    });
    return;
  }

  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 600
    ? error.status
    : 500;

  if (status >= 500) {
    req.app.locals.logger.error(error);
  }

  res.status(status).json({
    success: false,
    error: {
      code: error.code || (status === 500 ? "INTERNAL_SERVER_ERROR" : "REQUEST_ERROR"),
      message: status === 500 ? "An unexpected server error occurred" : error.message,
    },
  });
}
