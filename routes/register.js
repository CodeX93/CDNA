import express from "express";
import multer from "multer";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import JobSeeker from "../model/JobSeeker.js";

const router = express.Router();

// Multer setup for file upload
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Check if AWS S3 is configured
const isS3Configured =
  process.env.AWS_ACCESS_KEY_ID &&
  process.env.AWS_SECRET_ACCESS_KEY &&
  process.env.AWS_REGION &&
  process.env.AWS_S3_BUCKET;

// AWS S3 setup (only if configured)
let s3Client;
if (isS3Configured) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

router.post("/", upload.single("image"), async (req, res) => {
  try {
    const {
      email,
      password,
      fullName,
      headline,
      bio,
      website,
      github,
      gitlab,
      linkedin,
      experienceLevel,
      visibility,
      workCategories,
      skills,
    } = req.body;
    let imageUrl = "";

    // Upload image to S3 if present and configured
    if (req.file && isS3Configured) {
      const key = `jobseekers/${Date.now()}_${req.file.originalname}`;
      const params = {
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ACL: "public-read",
      };
      await s3Client.send(new PutObjectCommand(params));
      imageUrl = `https://${process.env.AWS_S3_BUCKET}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
    }

    // Save to MongoDB
    const jobSeeker = new JobSeeker({
      email,
      password,
      fullName,
      headline,
      bio,
      website,
      github,
      gitlab,
      linkedin,
      experienceLevel,
      visibility,
      workCategories,
      skills,
      imageUrl,
    });
    await jobSeeker.save();
    res.status(201).json({ success: true, data: jobSeeker });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/", async (req, res) => {
  try {
    // Optional filters via query params
    const {
      search,
      experienceLevel,
      visibility,
      limit = 20,
      page = 1,
    } = req.query;

    const query = {};

    if (visibility !== undefined) {
      query.visibility = visibility;
    }

    if (experienceLevel) {
      query.experienceLevel = experienceLevel;
    }

    if (search) {
      query.$or = [
        { fullName: { $regex: search, $options: "i" } },
        { headline: { $regex: search, $options: "i" } },
        { bio: { $regex: search, $options: "i" } },
        { skills: { $regex: search, $options: "i" } },
        { workCategories: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await JobSeeker.countDocuments(query);
    const jobSeekers = await JobSeeker.find(query)
      .skip(skip)
      .limit(Number(limit))
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: jobSeekers,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post("/bulk", async (req, res) => {
  try {
    const jobSeekers = Array.isArray(req.body) ? req.body : [];

    if (jobSeekers.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No job seekers provided." });
    }

    const preparedSeekers = jobSeekers.map((seeker) => {
      let workCategories = Array.isArray(seeker.workCategories)
        ? seeker.workCategories
        : (seeker.workCategories || "")
            .split(",")
            .map((c) => c.trim())
            .filter(Boolean);

      let skills = Array.isArray(seeker.skills)
        ? seeker.skills
        : (seeker.skills || "")
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean);

      return {
        fullName: seeker.fullName,
        headline: seeker.headline,
        bio: seeker.bio,
        email: seeker.email,
        password: seeker.password,
        website: seeker.website,
        github: seeker.github,
        gitlab: seeker.gitlab,
        linkedin: seeker.linkedin,
        experienceLevel: seeker.experienceLevel,
        visibility: seeker.visibility,
        workCategories,
        skills,
        imageUrl: seeker.imageUrl || "",
      };
    });

    const inserted = await JobSeeker.insertMany(preparedSeekers);

    res.status(201).json({ success: true, data: inserted });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router; 