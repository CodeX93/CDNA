import { config } from "../config/config.js"
import logger from "../util/logger.js"
import { connectMongo } from "../db/mongo.js"
import Job from "../models/Job.js"

let allJobsCache = null;
let thirdPartyJobsCache = [];
let thirdPartyJobsLastFetched = null;

class JobService {
  constructor() {
    this.baseUrl = config.xanoApi.baseUrl
    this.endpoint = config.xanoApi.endpoint
    this.authorization = config.xanoApi.authorization
  }

  async fetchJobsFromAPI(params = {}) {
    const { limit = config.pagination.defaultLimit, offset = config.pagination.defaultOffset, ...filters } = params

    const url = new URL(`${this.baseUrl}${this.endpoint}`)
    url.searchParams.append("limit", limit.toString())
    url.searchParams.append("offset", offset.toString())

    // Add any additional filters
    Object.keys(filters).forEach((key) => {
      if (filters[key] !== undefined && filters[key] !== null) {
        url.searchParams.append(key, filters[key].toString())
      }
    })

    const requestOptions = {
      method: "GET",
      headers: {
        Authorization: this.authorization,
        "Content-Type": "application/json",
        "User-Agent": "JobBoard-API/1.0",
      },
      timeout: config.xanoApi.timeout,
    }

    let lastError

    for (let attempt = 1; attempt <= config.xanoApi.retryAttempts; attempt++) {
      try {
        logger.info(`Fetching jobs from API (attempt ${attempt}/${config.xanoApi.retryAttempts}):`, url.toString())

        const response = await fetch(url.toString(), requestOptions)

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const data = await response.json()

        logger.info(`Successfully fetched ${data.length || 0} jobs from API`)
        return {
          success: true,
          data: data,
          total: response.headers.get("X-Total-Count") || data.length,
          hasMore: data.length === limit,
        }
      } catch (error) {
        lastError = error
        logger.error(`API fetch attempt ${attempt} failed:`, error.message)

        if (attempt < config.xanoApi.retryAttempts) {
          const delay = config.xanoApi.retryDelay * Math.pow(2, attempt - 1)
          logger.info(`Retrying in ${delay}ms...`)
          await new Promise((resolve) => setTimeout(resolve, delay))
        }
      }
    }

    return {
      success: false,
      error: lastError.message,
      data: [],
      total: 0,
      hasMore: false,
    }
  }

  async fetchAndCacheAllJobs() {
    // Fetch all jobs from external API
    const result = await this.fetchJobsFromAPI({ limit: 200000, offset: 0 });
    if (result.success && result.data.length > 0) {
      allJobsCache = result.data;
      // Removed cacheService.set("jobs:all", result.data, config.cache.jobsTtl);
    }
    return result;
  }

  async fetchAndCacheThirdPartyJobs() {
    const apiResult = await this.fetchJobsFromAPI({ limit: 200000, offset: 0 });
    if (apiResult.success && Array.isArray(apiResult.data)) {
      thirdPartyJobsCache = apiResult.data;
      thirdPartyJobsLastFetched = new Date();
    } else {
      // Do NOT clear thirdPartyJobsCache if fetch fails
      logger.warn("Failed to update third-party jobs cache, serving previous data if available.");
    }
  }

  async getJobs(params = {}) {
    const { limit = config.pagination.defaultLimit, offset = config.pagination.defaultOffset } = params;
    // 1. Fetch jobs from MongoDB
    await connectMongo();
    let dbJobs = await Job.find({}).sort({ created_at: -1 }).lean();
    // 2. Use cached third-party jobs
    let apiJobs = thirdPartyJobsCache || [];
    // 3. Combine both lists
    let allJobs = [...dbJobs, ...apiJobs];
    // Normalize tags to always be an array
    allJobs = allJobs.map(job => ({
      ...job,
      tags: Array.isArray(job.tags) ? job.tags : (job.tags ? [job.tags] : []),
    }));
    // 4. Sort by created_at (if both have it)
    allJobs.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    // 5. Paginate
    const paginated = allJobs.slice(Number(offset), Number(offset) + Number(limit));
    return {
      success: true,
      data: paginated,
      total: allJobs.length,
      hasMore: Number(offset) + Number(limit) < allJobs.length,
      fromCache: true,
      lastThirdPartyUpdate: thirdPartyJobsLastFetched,
    };
  }

  async searchJobs(query, params = {}) {
    const { limit = config.pagination.defaultLimit, offset = config.pagination.defaultOffset } = params

    // Get all jobs using the same method as getJobs
    const result = await this.getJobs({ limit: 5000, offset: 0 })
    if (!result.success) {
      return result
    }

    // Perform search on the dataset
    const searchResults = this.performSearch(result.data, query)

    // Apply pagination to search results
    const paginatedResults = searchResults.slice(offset, offset + limit)

    return {
      success: true,
      data: paginatedResults,
      total: searchResults.length,
      hasMore: offset + limit < searchResults.length,
      query: query,
      fromCache: false,
    }
  }

  performSearch(jobs, query) {
    if (!query || query.trim() === "") {
      return jobs
    }

    const searchTerm = query.toLowerCase().trim()

    return jobs.filter((job) => {
      // Search in common job fields with fallbacks for different field names
      const searchableFields = [
        job.title || job.position || job.job_title,
        job.company || job.company_name,
        job.description || job.job_description,
        job.location || job.job_location || job.city,
        job.skills,
        job.category || job.job_category,
        job.tags,
        job.requirements || job.job_requirements,
        job.responsibilities || job.job_responsibilities
      ].filter((field) => field) // Remove undefined/null fields

      return searchableFields.some((field) => {
        // Handle arrays (like tags, skills)
        if (Array.isArray(field)) {
          return field.some(item => 
            (typeof item === 'string' && item.toLowerCase().includes(searchTerm)) ||
            (typeof item === 'object' && item.label && item.label.toLowerCase().includes(searchTerm))
          )
        }
        // Handle strings
        return field.toString().toLowerCase().includes(searchTerm)
      })
    })
  }

  async getJobStats() {
    // Removed cacheKey = "jobs:stats" and cachedStats = await cacheService.get(cacheKey)
    // Removed if (cachedStats) { return cachedStats }

    // Get all jobs for stats calculation
    let allJobs = allJobsCache; // Use in-memory cache

    if (!allJobs) {
      const result = await this.fetchAndCacheAllJobs()
      if (!result.success) {
        return { success: false, error: "Failed to fetch jobs for stats" }
      }
      allJobs = result.data; // Assign result.data to allJobs
    }

    const stats = this.calculateStats(allJobs)

    // Removed cacheService.set(cacheKey, stats, config.cache.paginationTtl)

    return stats
  }

  calculateStats(jobs) {
    const stats = {
      total: jobs.length,
      byCompany: {},
      byLocation: {},
      byCategory: {},
      lastUpdated: new Date().toISOString(),
    }

    jobs.forEach((job) => {
      // Company stats
      if (job.company) {
        stats.byCompany[job.company] = (stats.byCompany[job.company] || 0) + 1
      }

      // Location stats
      if (job.location) {
        stats.byLocation[job.location] = (stats.byLocation[job.location] || 0) + 1
      }

      // Category stats
      if (job.category) {
        stats.byCategory[job.category] = (stats.byCategory[job.category] || 0) + 1
      }
    })

    return {
      success: true,
      data: stats,
    }
  }

  async clearCache() {
    // Removed cacheService.flushPattern("jobs:*")
    logger.info("Job cache cleared")
  }

  async addJob(job) {
    await connectMongo();
    // Assign a unique id and created_at timestamp if not present
    const newJob = await Job.create({
      ...job,
      created_at: job.created_at || Date.now(),
    });
    // Update in-memory and Redis cache
    if (!allJobsCache) {
      // Removed cacheService.get("jobs:all");
      // Removed if (!jobs) { await this.fetchAndCacheAllJobs(); jobs = allJobsCache || []; }
      allJobsCache = await this.fetchAndCacheAllJobs().then(res => res.data); // Assign result.data to allJobsCache
    }
    allJobsCache.unshift(newJob.toObject());
    // Removed try { await cacheService.set("jobs:all", allJobsCache, config.cache.jobsTtl); } catch (e) {}
    return newJob;
  }
}

export default new JobService()
