import mongoose from "mongoose";
import bcrypt from "bcrypt";

const jobSeekerSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  headline: { type: String, required: true },
  bio: { type: String, required: true },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
  },
  website: { type: String },
  github: { type: String },
  gitlab: { type: String },
  linkedin: { type: String },
  experienceLevel: { type: String },
  visibility: {
    type: String,
    enum: {
      values: ["public", "private", "limited"],
      message: "Visibility must be either public, private, or limited",
    },
    required: true,
  },
  workCategories: [String],
  skills: [String],
  imageUrl: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// Hash password before saving
jobSeekerSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare password
jobSeekerSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.models.JobSeeker ||
  mongoose.model("JobSeeker", jobSeekerSchema); 