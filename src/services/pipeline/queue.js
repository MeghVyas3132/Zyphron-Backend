/**
 * Build queue management
 * Handles concurrent build limitations
 */

const config = require('../../config');

// Queue state
const queue = {
  builds: [],
  current: 0,
  maxConcurrent: config.build.maxConcurrentBuilds,

  /**
   * Check if queue can accept a new build
   */
  canAcceptBuild() {
    return this.current < this.maxConcurrent;
  },

  /**
   * Add a task to the queue
   * @param {Function} task - Async task to execute
   * @returns {Promise} - Resolves when task completes
   */
  async add(task) {
    return new Promise((resolve, reject) => {
      const queuedBuild = {
        task,
        resolve,
        reject,
        queuedAt: Date.now(),
      };

      if (this.canAcceptBuild()) {
        this.runBuild(queuedBuild);
      } else {
        this.builds.push(queuedBuild);
      }
    });
  },

  /**
   * Run a queued build
   * @param {Object} queuedBuild - Build object with task, resolve, reject
   */
  async runBuild(queuedBuild) {
    this.current++;
    try {
      const result = await queuedBuild.task();
      queuedBuild.resolve(result);
    } catch (error) {
      queuedBuild.reject(error);
    } finally {
      this.current--;
      this.processNextBuild();
    }
  },

  /**
   * Process next build in queue
   */
  processNextBuild() {
    if (this.builds.length > 0 && this.canAcceptBuild()) {
      const nextBuild = this.builds.shift();
      this.runBuild(nextBuild);
    }
  },

  /**
   * Get position in queue for a project
   * @param {string} projectName - Project name
   * @returns {number|null} - Queue position (1-indexed) or null
   */
  getQueuePosition(projectName) {
    const index = this.builds.findIndex(b => b.task.projectName === projectName);
    return index === -1 ? null : index + 1;
  },

  /**
   * Get current queue status
   */
  getQueueStatus() {
    return {
      running: this.current,
      queued: this.builds.length,
      maxConcurrent: this.maxConcurrent,
    };
  },

  /**
   * Clear all queued builds
   */
  clearQueue() {
    const cleared = this.builds.length;
    this.builds.forEach(build => {
      build.reject(new Error('Queue cleared'));
    });
    this.builds = [];
    return cleared;
  },
};

// Pipeline queue (separate from build queue for isolation)
let currentRunningPipelines = 0;
const pipelineQueue = [];
const MAX_CONCURRENT_PIPELINES = config.pipeline.maxConcurrent;

/**
 * Add pipeline to queue
 * @param {Function} task - Async pipeline task
 * @returns {Promise} - Resolves when pipeline completes
 */
function queuePipeline(task) {
  return new Promise((resolve, reject) => {
    const wrappedTask = async () => {
      currentRunningPipelines++;
      try {
        await task();
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        currentRunningPipelines--;
        if (pipelineQueue.length > 0) {
          const next = pipelineQueue.shift();
          setImmediate(next);
        }
      }
    };

    if (currentRunningPipelines < MAX_CONCURRENT_PIPELINES) {
      setImmediate(wrappedTask);
    } else {
      console.log(`Max concurrent pipelines reached (${MAX_CONCURRENT_PIPELINES}). Queuing pipeline.`);
      pipelineQueue.push(wrappedTask);
    }
  });
}

/**
 * Get pipeline queue status
 */
function getPipelineQueueStatus() {
  return {
    running: currentRunningPipelines,
    queued: pipelineQueue.length,
    maxConcurrent: MAX_CONCURRENT_PIPELINES,
  };
}

module.exports = {
  queue,
  queuePipeline,
  getPipelineQueueStatus,
};
