import { z } from "zod";

export enum PipelineStage {
  IDEA = "IDEA",
  BA = "BA_ANALYSIS",
  PM = "PM_PLANNING",
  DEV = "DEV_IMPLEMENTATION",
  QA_AUTO = "QA_AUTOMATION",
  QA_MANUAL = "QA_MANUAL",
  DEVOPS = "DEVOPS_DEPLOY",
  DONE = "DONE",
  FAILED = "FAILED"
}

export const PipelineTaskSchema = z.object({
  id: z.string(),
  idea: z.string(),
  stage: z.nativeEnum(PipelineStage),
  data: z.record(z.any()),
  history: z.array(z.object({
    stage: z.string(),
    result: z.any().optional(),
    error: z.string().optional(),
    timestamp: z.number()
  })),
  retries: z.number()
});

export type PipelineTask = z.infer<typeof PipelineTaskSchema>;

export interface ExecutionLayer {
  applyDevChanges(branch: string, changes: any[], repoUrl: string): Promise<void>;
  runQaTests(tests: any[], repoUrl: string): Promise<any>;
}
