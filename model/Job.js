import mongoose from "mongoose";

const jobSchema = new mongoose.Schema({
  position: { type: String, required: true },
  company: { type: String, required: true },
  description: { type: String, required: true },
  job_location: String,
  application_url: String,
  job_id: { type: String, unique: true },
  posted_date: { type: Date },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  created_at: { type: Date, default: Date.now },
  // New fields from frontend post-job form
  companyUrl: String,
  experienceLevel: String,
  salary: String,
  relocationSupport: String,
  visaIncluded: String,
  applyFromAbroad: String,
  remoteWorkPolicy: String,
  role: String,
  invoiceEmail: String,
  invoiceAddress: String,
  invoiceNotes: String,
  payLater: Boolean,
  languages: [String],
  categories: [String],
  skills: [String],
  minSalary: String,
  maxSalary: String,
});

export default mongoose.models.Job || mongoose.model("Job", jobSchema); 