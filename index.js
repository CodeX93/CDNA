
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
const MONGO_URI = process.env.MONGO_URI || "your_mongodb_connection_string";

// Connect to MongoDB only if not in Vercel environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  mongoose
    .connect(MONGO_URI)
    .then(() => logger.info("MongoDB connected"))
    .catch((err) => logger.error("MongoDB connection error:", err));
}

app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.use("/api/jobs", validatePagination, validateSearch, jobRoutes);
app.use("/api/health", healthRoutes);
app.use("/api/register", registerRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/jobseekers", jobSeekersRoutes);

// Centralized Error Handling
app.use(errorHandler);

// 404 Not Found Middleware
app.use((req, res, next) => {
  res.status(404).json({ success: false, error: "Not Found" });
});

app.get("/", (req, res) => {
  res.send("Server Running");
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ success: false, error: "Internal Server Error" });
});

// For local development
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  app.listen(PORT, () => {
    logger.info(`Server is running on port ${PORT}`);
  });
}

// Export for Vercel serverless
export default app;
