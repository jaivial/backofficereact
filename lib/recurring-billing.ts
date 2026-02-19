// Background Job Utility for Recurring Invoice Processing
// This utility provides functions to manage and schedule background jobs for auto-generating invoices

export type JobStatus = "idle" | "running" | "completed" | "failed";

export type RecurringJobResult = {
  processed: number;
  generated: number;
  errors: number;
  details: Array<{
    recurringInvoiceId: number;
    success: boolean;
    invoiceId?: number;
    error?: string;
  }>;
};

export type JobInfo = {
  id: string;
  type: "recurring_invoices" | "reminders" | "cleanup";
  status: JobStatus;
  lastRun: string | null;
  nextRun: string | null;
  lastResult?: RecurringJobResult;
  interval: number; // in milliseconds
  enabled: boolean;
};

// Calculate next run time based on interval
export function calculateNextRun(intervalMs: number): string {
  return new Date(Date.now() + intervalMs).toISOString();
}

// Format interval for display
export function formatInterval(intervalMs: number): string {
  const minutes = Math.floor(intervalMs / 60000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days} día${days > 1 ? "s" : ""}`;
  }
  if (hours > 0) {
    return `${hours} hora${hours > 1 ? "s" : ""}`;
  }
  return `${minutes} minuto${minutes > 1 ? "s" : ""}`;
}

// Common job intervals (in milliseconds)
export const JOB_INTERVALS = {
  EVERY_MINUTE: 60 * 1000,
  EVERY_5_MINUTES: 5 * 60 * 1000,
  EVERY_15_MINUTES: 15 * 60 * 1000,
  EVERY_30_MINUTES: 30 * 60 * 1000,
  EVERY_HOUR: 60 * 60 * 1000,
  EVERY_DAY: 24 * 60 * 60 * 1000,
  EVERY_WEEK: 7 * 24 * 60 * 60 * 1000,
} as const;

// Job configuration for recurring invoice processing
export const DEFAULT_RECURRING_JOB_CONFIG = {
  type: "recurring_invoices" as const,
  interval: JOB_INTERVALS.EVERY_DAY, // Run once per day by default
  enabled: true,
  description: "Procesa facturas recurrentes pendientes y genera nuevas facturas automáticamente",
};

// Simulated job scheduler (for demonstration purposes)
// In a real implementation, this would be handled by the backend
export class RecurringInvoiceJobScheduler {
  private jobs: Map<string, JobInfo> = new Map();
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private processCallback: ((jobType: string) => Promise<RecurringJobResult>) | null = null;

  constructor() {
    this.initializeDefaultJobs();
  }

  private initializeDefaultJobs() {
    // Initialize recurring invoices job
    this.jobs.set("recurring_invoices", {
      id: "recurring_invoices",
      type: "recurring_invoices",
      status: "idle",
      lastRun: null,
      nextRun: calculateNextRun(DEFAULT_RECURRING_JOB_CONFIG.interval),
      interval: DEFAULT_RECURRING_JOB_CONFIG.interval,
      enabled: DEFAULT_RECURRING_JOB_CONFIG.enabled,
    });

    // Initialize reminders job
    this.jobs.set("reminders", {
      id: "reminders",
      type: "reminders",
      status: "idle",
      lastRun: null,
      nextRun: calculateNextRun(JOB_INTERVALS.EVERY_DAY),
      interval: JOB_INTERVALS.EVERY_DAY,
      enabled: true,
    });

    // Initialize cleanup job
    this.jobs.set("cleanup", {
      id: "cleanup",
      type: "cleanup",
      status: "idle",
      lastRun: null,
      nextRun: calculateNextRun(JOB_INTERVALS.EVERY_WEEK),
      interval: JOB_INTERVALS.EVERY_WEEK,
      enabled: true,
    });
  }

  // Set the callback function that processes the job
  setProcessCallback(callback: (jobType: string) => Promise<RecurringJobResult>) {
    this.processCallback = callback;
  }

  // Get job information
  getJobInfo(jobType: string): JobInfo | undefined {
    return this.jobs.get(jobType);
  }

  // Get all jobs
  getAllJobs(): JobInfo[] {
    return Array.from(this.jobs.values());
  }

  // Enable/disable a job
  setJobEnabled(jobType: string, enabled: boolean): boolean {
    const job = this.jobs.get(jobType);
    if (!job) return false;

    job.enabled = enabled;

    if (!enabled && this.timers.has(jobType)) {
      clearTimeout(this.timers.get(jobType)!);
      this.timers.delete(jobType);
    }

    if (enabled && !this.timers.has(jobType)) {
      this.scheduleJob(jobType);
    }

    return true;
  }

  // Update job interval
  setJobInterval(jobType: string, intervalMs: number): boolean {
    const job = this.jobs.get(jobType);
    if (!job) return false;

    job.interval = intervalMs;
    job.nextRun = calculateNextRun(intervalMs);

    // Reschedule if running
    if (this.timers.has(jobType)) {
      clearTimeout(this.timers.get(jobType)!);
      this.scheduleJob(jobType);
    }

    return true;
  }

  // Schedule a job to run
  private scheduleJob(jobType: string) {
    const job = this.jobs.get(jobType);
    if (!job || !job.enabled) return;

    const timer = setTimeout(async () => {
      await this.runJob(jobType);
    }, job.interval);

    this.timers.set(jobType, timer);
    job.nextRun = calculateNextRun(job.interval);
  }

  // Run a job immediately
  async runJob(jobType: string): Promise<RecurringJobResult | null> {
    const job = this.jobs.get(jobType);
    if (!job || !job.enabled) return null;

    job.status = "running";

    try {
      if (!this.processCallback) {
        throw new Error("No process callback configured");
      }

      const result = await this.processCallback(jobType);

      job.status = "completed";
      job.lastRun = new Date().toISOString();
      job.lastResult = result;
      job.nextRun = calculateNextRun(job.interval);

      // Reschedule
      this.scheduleJob(jobType);

      return result;
    } catch (error) {
      job.status = "failed";
      job.lastRun = new Date().toISOString();
      job.lastResult = {
        processed: 0,
        generated: 0,
        errors: 1,
        details: [{
          recurringInvoiceId: 0,
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        }],
      };

      // Still reschedule even on failure
      this.scheduleJob(jobType);

      return null;
    }
  }

  // Manually trigger a job
  async triggerJob(jobType: string): Promise<RecurringJobResult | null> {
    return this.runJob(jobType);
  }

  // Stop all jobs
  stopAll() {
    for (const [jobType, timer] of this.timers) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  // Clean up on unmount
  destroy() {
    this.stopAll();
  }
}

// Singleton instance
let schedulerInstance: RecurringInvoiceJobScheduler | null = null;

export function getJobScheduler(): RecurringInvoiceJobScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new RecurringInvoiceJobScheduler();
  }
  return schedulerInstance;
}

// Hook for using the job scheduler in React components
export function useJobScheduler() {
  const scheduler = getJobScheduler();

  return {
    getJobInfo: scheduler.getJobInfo.bind(scheduler),
    getAllJobs: scheduler.getAllJobs.bind(scheduler),
    setJobEnabled: scheduler.setJobEnabled.bind(scheduler),
    setJobInterval: scheduler.setJobInterval.bind(scheduler),
    triggerJob: scheduler.triggerJob.bind(scheduler),
  };
}
