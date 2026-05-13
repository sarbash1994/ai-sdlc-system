import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { WorkerJob } from "@ai-sdlc/types";

export const PIPELINE_QUEUE_NAME = "ai-sdlc-pipeline";

export type LocalQueueRecord = {
  id: string;
  name: string;
  data: WorkerJob;
  status: "queued" | "processing" | "completed" | "failed";
  attempts: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

const queuePath = "storage/jobs.json";

export function createPipelineQueue(_redisUrl: string): {
  add(name: string, data: WorkerJob): Promise<LocalQueueRecord>;
} {
  return {
    async add(name, data) {
      const jobs = await readJobs();
      const timestamp = new Date().toISOString();
      const record: LocalQueueRecord = {
        id: `job_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name,
        data,
        status: "queued",
        attempts: 0,
        createdAt: timestamp,
        updatedAt: timestamp
      };
      jobs.push(record);
      await writeJobs(jobs);
      return record;
    }
  };
}

export async function recoverStuckJobs(): Promise<number> {
  const jobs = await readJobs();
  let count = 0;
  const timestamp = new Date().toISOString();
  for (const job of jobs) {
    if (job.status === "processing") {
      job.status = "queued";
      job.error = "recovered: worker restarted during processing";
      job.updatedAt = timestamp;
      count++;
    }
  }
  if (count > 0) {
    await writeJobs(jobs);
  }
  return count;
}

export async function claimNextLocalJob(): Promise<LocalQueueRecord | undefined> {
  const jobs = await readJobs();
  const absPath = resolve(queuePath);
  
  if (jobs.length > 0 || Math.random() < 0.2) {
    console.log(`[Queue] Polling ${absPath}: found ${jobs.length} jobs. Statuses: ${jobs.map(j => j.status).join(', ')}`);
  }
  const index = jobs.findIndex((job) => job.status === "queued");
  if (index === -1) {
    return undefined;
  }

  const job = jobs[index];
  if (!job) {
    return undefined;
  }

  const updated: LocalQueueRecord = {
    ...job,
    status: "processing",
    attempts: job.attempts + 1,
    updatedAt: new Date().toISOString()
  };
  jobs[index] = updated;
  await writeJobs(jobs);
  return updated;
}

export async function completeLocalJob(jobId: string): Promise<void> {
  await updateJob(jobId, { status: "completed", error: undefined });
}

export async function failLocalJob(jobId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await updateJob(jobId, { status: "failed", error: message });
}

async function updateJob(
  jobId: string,
  patch: Pick<LocalQueueRecord, "status"> & Partial<Pick<LocalQueueRecord, "error">>
): Promise<void> {
  const jobs = await readJobs();
  const index = jobs.findIndex((job) => job.id === jobId);
  if (index === -1) {
    return;
  }

  jobs[index] = {
    ...jobs[index]!,
    ...patch,
    updatedAt: new Date().toISOString()
  };
  await writeJobs(jobs);
}

async function readJobs(): Promise<LocalQueueRecord[]> {
  const absPath = resolve(queuePath);
  try {
    const content = await readFile(queuePath, "utf8");
    if (!content.trim()) return [];
    return JSON.parse(content) as LocalQueueRecord[];
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    console.error(`[Queue] Error reading jobs from ${absPath}:`, error);
    return []; 
  }
}

async function writeJobs(jobs: LocalQueueRecord[]): Promise<void> {
  await mkdir(dirname(queuePath), { recursive: true });
  await writeFile(queuePath, `${JSON.stringify(jobs, null, 2)}\n`, "utf8");
}
