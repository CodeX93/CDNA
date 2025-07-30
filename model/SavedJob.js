import mongoose from "mongoose";

const savedJobSchema = new mongoose.Schema({
  userEmail: { type: String, required: true },
  job: { type: Object, required: true }, // Store the job object as-is
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.SavedJob || mongoose.model("SavedJob", savedJobSchema); 