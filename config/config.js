import dotenv from "dotenv"
dotenv.config()

export const config = {
  port: process.env.PORT || 3005,
  xanoApi: {
    baseUrl: "https://xego-gkh0-s2zi.f2.xano.io/api:b5rUlFxJ",
    endpoint: "/jobs/for-you/public-job-board",
    authorization:
      process.env.XANO_AUTH ||
      "eyJrdHkiOiJvY3QiLCJrIjoiVTFrNnl1eW5abUVybUhodkZITDYtbjhqZnB4VG9pOG5UX1lvZ2puOURtQnF6TjVVbGtZaC1WQldsLXJJMmZyOXRWdVlmYURFenFmZGVTNHNNdmdsMnJGWXpySFhwb2ZpOGJnTjJlbWkydHBGejlrUXE3aFhtcjAxcldZNDZXNUhIdWJhY0FIcWQ0dUluemlySzVRY283ZUxlcFdzVkVJS3hSWGxIY3hyWG9NIn0=",
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000,
  },
  cache: {
    jobsTtl: 3600, // 1 hour
    paginationTtl: 1800, // 30 minutes
    maxCacheSize: 1000000, // 1MB
  },
  pagination: {
    defaultLimit: 50,
    maxLimit: 500,
    defaultOffset: 0,
  },
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  },
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
  },
}
