import { config } from "../config/config.js"

export const validatePagination = (req, res, next) => {
  const { limit, offset } = req.query

  // Validate limit
  if (limit !== undefined) {
    const parsedLimit = Number.parseInt(limit, 10)
    if (isNaN(parsedLimit) || parsedLimit < 1) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Invalid limit parameter. Must be a positive integer.",
          field: "limit",
        },
      })
    }
    if (parsedLimit > config.pagination.maxLimit) {
      return res.status(400).json({
        success: false,
        error: {
          message: `Limit cannot exceed ${config.pagination.maxLimit}`,
          field: "limit",
        },
      })
    }
    req.query.limit = parsedLimit
  } else {
    req.query.limit = config.pagination.defaultLimit
  }

  // Validate offset
  if (offset !== undefined) {
    const parsedOffset = Number.parseInt(offset, 10)
    if (isNaN(parsedOffset) || parsedOffset < 0) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Invalid offset parameter. Must be a non-negative integer.",
          field: "offset",
        },
      })
    }
    req.query.offset = parsedOffset
  } else {
    req.query.offset = config.pagination.defaultOffset
  }

  next()
}

export const validateSearch = (req, res, next) => {
  const { q } = req.query

  if (q !== undefined) {
    if (typeof q !== "string") {
      return res.status(400).json({
        success: false,
        error: {
          message: "Search query must be a string",
          field: "q",
        },
      })
    }

    if (q.length > 200) {
      return res.status(400).json({
        success: false,
        error: {
          message: "Search query too long. Maximum 200 characters.",
          field: "q",
        },
      })
    }

    req.query.q = q.trim()
  }

  next()
}
