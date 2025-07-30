import express from "express"
import { config } from "../config/config.js"

const router = express.Router()

// GET /api/health - Health check endpoint
router.get("/", async (req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    services: {
      api: "healthy",
      cache: "unknown",
    },
  }

  // Check XANO API connectivity
  try {
    const testUrl = `${config.xanoApi.baseUrl}${config.xanoApi.endpoint}?limit=1`
    const response = await fetch(testUrl, {
      method: "GET",
      headers: {
        Authorization: config.xanoApi.authorization,
        "Content-Type": "application/json",
      },
      timeout: 5000,
    })

    if (response.ok) {
      health.services.xanoApi = "healthy"
    } else {
      health.services.xanoApi = "error"
      health.status = "degraded"
    }
  } catch (error) {
    health.services.xanoApi = "error"
    health.status = "degraded"
  }

  const statusCode = health.status === "healthy" ? 200 : 503
  res.status(statusCode).json(health)
})

export default router
