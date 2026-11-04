import {asyncHandler} from "../middleware/asyncHandler.js";

export const getHealth = asyncHandler(async (req, res) => {
  try {
    await req.app.locals.db.$queryRaw`SELECT 1`;
  } catch (error) {
    req.app.locals.logger.error(error);
    res.status(503).json({
      success: false,
      error: {
        code: "DATABASE_UNAVAILABLE",
        message: "Database health check failed",
      },
    });
    return;
  }

  res.status(200).json({
    success: true,
    data: {status: "ok", database: "connected"},
  });
});
