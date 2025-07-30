import express from "express";
import axios from "axios";
import logger from "../util/logger.js";
import Job from "../model/Job.js";
import SavedJob from "../model/SavedJob.js";
import jwt from "jsonwebtoken";
import JobSeeker from "../model/JobSeeker.js";
import { config } from "../config/config.js";
import Stripe from "stripe";
import { v4 as uuidv4 } from 'uuid';

const stripe = new Stripe(config.stripe.secretKey);

const router = express.Router();

const cache = new Map();
const AUTH_TOKEN = "eyJrdHkiOiJvY3QiLCJrIjoiVTFrNnl1eW5abUVybUhodkZITDYtbjhqZnB4VG9pOG5UX1lvZ2puOURtQnF6TjVVbGtZaC1WQldsLXJJMmZyOXRWdVlmYURFenFmZGVTNHNNdmdsMnJGWXpySFhwb2ZpOGJnTjJlbWkydHBGejlrUXE3aFhtcjAxcldZNDZXNUhIdWJhY0FIcWQ0dUluemlySzVRY283ZUxlcFdzVkVJS3hSWGxIY3hyWG9NIn0=";

// GET /api/jobs/search - search jobs from both DB and external API
router.get('/search', async (req, res) => {
  try {
    // Fetch from your DB (add filters as needed)
    let dbQuery = {};
    if (req.query.job_position) {
      dbQuery.position = { $regex: req.query.job_position, $options: 'i' };
    }
    const dbJobs = await Job.find(dbQuery);

    // Fetch from external API (real endpoint)
    const API_URL = "https://xego-gkh0-s2zi.f2.xano.io/api:b5rUlFxJ/jobs/for-you/public-job-board";
    let externalJobs = [];
    try {
      const externalRes = await axios.get(API_URL, {
        params: { job_position: req.query.job_position },
        headers: { Authorization: AUTH_TOKEN }
      });
      // Fix: handle both array and object with data property
      externalJobs = Array.isArray(externalRes.data) ? externalRes.data : (externalRes.data.data || []);
    } catch (err) {
      externalJobs = [];
    }
    // Sort both DB and external jobs by posted_date descending
    const sortByDateDesc = (a, b) => new Date(b.posted_date) - new Date(a.posted_date);
    dbJobs.sort(sortByDateDesc);
    externalJobs.sort(sortByDateDesc);
    // Merge and return
    const allJobs = [...dbJobs, ...externalJobs];
    allJobs.sort(sortByDateDesc);
    res.json({ success: true, data: allJobs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// POST /api/jobs/create-payment-intent - create a Stripe payment intent
router.post('/create-payment-intent', async (req, res) => {
  console.log('Received payment intent request', req.body);
  try {
    let { amount } = req.body;
    if (!amount) {
      amount = 199;
    }
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // amount in cents
      currency: 'usd',
      payment_method_types: ['card'],
    });
    res.json({ success: true, clientSecret: paymentIntent.client_secret });
  } catch (err) {
    console.error('Stripe payment intent error:', err);
    res.status(500).json({ success: false, error: err.message || 'Stripe error' });
  }
});

// POST /api/jobs - create a new job (requires payment)
router.post('/', async (req, res) => {
  try {
    console.log('Job post request body:', req.body); // Log the incoming request
    const { paymentIntentId } = req.body;
    if (!paymentIntentId) {
      return res.status(400).json({ success: false, error: 'Payment is required' });
    }
    // Verify payment intent status
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    if (paymentIntent.status !== 'succeeded') {
      return res.status(402).json({ success: false, error: 'Payment not completed' });
    }
    const {
      company,
      position,
      description,
      job_location,
      application_url,
      posted_date,
      city,
      state,
      country
    } = req.body;
    if (!company || !position || !description || !job_location) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const newJob = new Job({
      job_id: uuidv4(), // Always generate a unique job_id
      company,
      position,
      description,
      job_location,
      application_url,
      posted_date: posted_date || new Date(),
      city,
      state,
      country
    });
    await newJob.save();
    res.status(201).json({ success: true, data: newJob });
  } catch (err) {
    console.error('Job post error:', err); // Log the full error
    res.status(500).json({ success: false, error: err.message || 'Server error' }); // Return real error
  }
});

// POST /api/jobs/save - save a job for the logged-in user
router.post('/save', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token, authorization denied' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await JobSeeker.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const job = req.body.job;
    if (!job) {
      return res.status(400).json({ success: false, error: 'No job data provided' });
    }
    // Optionally, prevent duplicate saves for the same job and user
    const exists = await SavedJob.findOne({ userEmail: user.email, 'job.job_id': job.job_id });
    if (exists) {
      return res.status(409).json({ success: false, error: 'Job already saved' });
    }
    const savedJob = new SavedJob({ userEmail: user.email, job });
    await savedJob.save();
    res.status(201).json({ success: true, data: savedJob });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// GET /api/jobs/saved - get saved jobs for the logged-in user
router.get('/saved', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token, authorization denied' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await JobSeeker.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const savedJobs = await SavedJob.find({ userEmail: user.email }).sort({ createdAt: -1 });
    res.json({ success: true, data: savedJobs });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

// DELETE /api/jobs/saved/:id - delete a saved job for the logged-in user
router.delete('/saved/:id', async (req, res) => {
  try {
    const token = req.cookies.token;
    if (!token) {
      return res.status(401).json({ success: false, error: 'No token, authorization denied' });
    }
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await JobSeeker.findById(decoded.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    const savedJob = await SavedJob.findOne({ _id: req.params.id, userEmail: user.email });
    if (!savedJob) {
      return res.status(404).json({ success: false, error: 'Saved job not found' });
    }
    await SavedJob.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Server error' });
  }
});

export default router;
