import express from "express";
import JobSeeker from "../model/JobSeeker.js";
const router = express.Router();

// GET /api/jobseekers - list all job seekers
router.get("/", async (req, res) => {
  try {
    const seekers = await JobSeeker.find().select("-password");
    res.json({ success: true, data: seekers });
  } catch (err) {
    res.status(500).json({ success: false, error: "Server error" });
  }
});

export default router; 