import logger from "../util/logger.js"

export const errorHandler = (err, req, res, next) => {
  logger.error("Unhandled error:", {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
  })

  // Default error response
  let statusCode = 500
  let message = "Internal Server Error"

  // Handle specific error types
  if (err.name === "ValidationError") {
    statusCode = 400
    message = "Validation Error"
  } else if (err.name === "UnauthorizedError") {
    statusCode = 401
    message = "Unauthorized"
  } else if (err.message.includes("timeout")) {
    statusCode = 504
    message = "Gateway Timeout"
  } else if (err.message.includes("ECONNREFUSED")) {
    statusCode = 503
    message = "Service Unavailable"
  }

  res.status(statusCode).json({
    success: false,
    error: {
      message: message,
      ...(process.env.NODE_ENV === "development" && {
        details: err.message,
        stack: err.stack,
      }),
    },
    timestamp: new Date().toISOString(),
  })
}

export const notFoundHandler = (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      message: "Endpoint not found",
      path: req.path,
    },
    timestamp: new Date().toISOString(),
  })
}
