# Backend Deployment Guide for Vercel

## Prerequisites

1. Make sure you have the Vercel CLI installed:
   ```bash
   npm i -g vercel
   ```

2. Ensure all environment variables are set in Vercel:
   - `MONGO_URI` - Your MongoDB connection string
   - `FRONTEND_URL` - Your frontend URL (optional, defaults to localhost:3000)
   - Any other environment variables your app needs

## Deployment Steps

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Deploy to Vercel:**
   ```bash
   vercel --prod
   ```

3. **Set environment variables in Vercel dashboard:**
   - Go to your Vercel project dashboard
   - Navigate to Settings > Environment Variables
   - Add all required environment variables

## Important Notes

- The backend is configured as a serverless function
- MongoDB connection is optimized for serverless environment
- CORS is configured to allow your frontend domain
- The API will be available at your Vercel domain

## Troubleshooting

1. **If you get module not found errors:**
   - Make sure all dependencies are in package.json
   - Run `npm install` before deploying

2. **If MongoDB connection fails:**
   - Check your MONGO_URI environment variable
   - Ensure your MongoDB cluster allows connections from Vercel's IP ranges

3. **If CORS errors occur:**
   - Update the FRONTEND_URL environment variable
   - Or modify the CORS configuration in index.js

## Local Development

To run locally:
```bash
npm start
```

The server will run on port 3000 by default. 