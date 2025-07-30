
import dotenv from 'dotenv';
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import jobRoutes from "./routes/jobs.js";
import healthRoutes from "./routes/health.js";
import registerRoutes from "./routes/register.js";
import authRoutes from "./routes/auth.js";
import logger from "./util/logger.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { validatePagination, validateSearch } from "./middleware/validation.js";
import cookieParser from "cookie-parser";
import jobSeekersRoutes from "./routes/jobseekers.js";

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;

// MongoDB connection function with better error handling
const connectDB = async () => {
  try {
    if (!MONGO_URI) {
      logger.warn("MONGO_URI not provided, skipping database connection");
      return;
    }

    if (mongoose.connection.readyState === 1) {
      logger.info("MongoDB already connected");
      return;
    }
    
    await mongoose.connect(MONGO_URI, {
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      bufferCommands: false,
      bufferMaxEntries: 0
    });
    logger.info("MongoDB connected successfully");
  } catch (err) {
    logger.error("MongoDB connection error:", err.message);
    // Don't throw error, let the app continue without DB
  }
};

// Initialize database connection
connectDB();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Health check route (no DB dependency)
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Root route
app.get("/", (req, res) => {
  res.json({ 
    message: "Server Running", 
    timestamp: new Date().toISOString() 
  });
});

// API routes (only if DB is connected)
if (MONGO_URI) {
  app.use("/api/jobs", validatePagination, validateSearch, jobRoutes);
  app.use("/api/register", registerRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/jobseekers", jobSeekersRoutes);
} else {
  // Fallback routes when DB is not available
  app.use("/api/jobs", (req, res) => {
    res.status(503).json({ 
      success: false, 
      error: "Database not configured" 
    });
  });
  app.use("/api/register", (req, res) => {
    res.status(503).json({ 
      success: false, 
      error: "Database not configured" 
    });
  });
  app.use("/api/auth", (req, res) => {
    res.status(503).json({ 
      success: false, 
      error: "Database not configured" 
    });
  });
  app.use("/api/jobseekers", (req, res) => {
    res.status(503).json({ 
      success: false, 
      error: "Database not configured" 
    });
  });
}

// Centralized Error Handling
app.use(errorHandler);

// 404 Not Found Middleware
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: "Not Found",
    path: req.path 
  });
});

// Global Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  logger.error(err.stack);
  res.status(500).json({ 
    success: false, 
    error: "Internal Server Error",
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
}

// Export for Vercel serverless
export default app;
