import { z } from "zod";

export const pipelineStageSchema = z.enum([
  "IDEA",
  "BA_ANALYSIS",
  "PM_PLANNING",
  "ARCHITECTURE_COMMITTEE",
  "DEV_IMPLEMENTATION",
  "QA_AUTOMATION",
  "QA_MANUAL",
  "DEVOPS_DEPLOY",
  "DONE"
]);

export type PipelineStage = z.infer<typeof pipelineStageSchema>;

export const taskStatusSchema = z.enum([
  "queued",
  "running",
  "waiting_for_approval",
  "failed",
  "done"
]);

export type TaskStatus = z.infer<typeof taskStatusSchema>;

export const baOutputSchema = z.object({
  business_requirements: z.array(z.string()).min(1),
  user_stories: z.array(
    z.union([
      z.string(),
      z.object({
        role: z.string().optional(),
        goal: z.string().optional(),
        benefit: z.string().optional()
      })
    ])
  ).min(1),
  edge_cases: z.array(z.string()).default([]),
  assumptions: z.array(z.string()).default([])
});

export type BAOutput = z.infer<typeof baOutputSchema>;

export const pmTaskTypeSchema = z.enum(["frontend", "backend", "mobile", "devops"]);

export const pmTaskSchema = z.object({
  id: z.string().optional(),
  type: pmTaskTypeSchema,
  title: z.string().optional(),
  description: z.string().min(1),
  acceptance_criteria: z.array(z.string()).min(1),
  dependencies: z.array(z.string()).default([]),
  estimated_effort: z.string().optional()
});

export const pmOutputSchema = z.object({
  tasks: z.array(pmTaskSchema).min(1)
});

export type PMTask = z.infer<typeof pmTaskSchema>;
export type PMOutput = z.infer<typeof pmOutputSchema>;

export const backendDevOutputSchema = z.object({
  branch: z.string().regex(/^feature\/[a-z0-9._/-]+$/),
  changes: z.array(
    z.object({
      file: z.string().min(1),
      diff: z.string().min(1),
      rationale: z.string().min(1)
    })
  ).min(1),
  commands: z.array(z.string()).default([])
});

export type BackendDevOutput = z.infer<typeof backendDevOutputSchema>;

export const qaAutomationOutputSchema = z.object({
  changes: z.array(
    z.object({
      file: z.string().min(1),
      content: z.string().min(1),
      rationale: z.string().min(1)
    })
  ).min(1),
  commands: z.array(z.string()).default([])
});

export type QAAutomationOutput = z.infer<typeof qaAutomationOutputSchema>;

export const qaManualOutputSchema = z.object({
  checklist: z.array(z.string()).default([]),
  edge_cases: z.array(z.string()).default([]),
  ux_issues: z.array(z.string()).default([])
});

export type QAManualOutput = z.infer<typeof qaManualOutputSchema>;

export const executionRecordSchema = z.object({
  agent: z.string(),
  input: z.unknown(),
  output: z.unknown(),
  timestamp: z.string()
});

export type ExecutionRecord = z.infer<typeof executionRecordSchema>;

export const stageRecordSchema = z.object({
  name: pipelineStageSchema,
  status: taskStatusSchema,
  attempts: z.number().int().nonnegative(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  error: z.string().optional()
});

export type StageRecord = z.infer<typeof stageRecordSchema>;

export const committeeMessageSchema = z.object({
  agent: z.string(),
  message: z.string(),
  vote: z.enum(["approve", "reject", "discuss"])
});

export type CommitteeMessage = z.infer<typeof committeeMessageSchema>;

export const sdlcTaskSchema = z.object({
  id: z.string(),
  idea: z.string(),
  status: taskStatusSchema,
  currentStage: pipelineStageSchema,
  stages: z.array(stageRecordSchema),
  logs: z.array(z.string()),
  executions: z.array(executionRecordSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
  telegramChatId: z.number().optional(),
  baOutput: baOutputSchema.optional(),
  pmOutput: pmOutputSchema.optional(),
  backendDevOutput: backendDevOutputSchema.optional(),
  pullRequestUrl: z.string().url().optional(),
  clarifyingQuestions: z.array(z.string()).optional(),
  clarifyingAnswers: z.string().optional(),
  qaAutomationOutput: qaAutomationOutputSchema.optional(),
  committeeDiscussion: z.array(committeeMessageSchema).optional()
});

export type SDLCTask = z.infer<typeof sdlcTaskSchema>;

export const createIdeaInputSchema = z.object({
  idea: z.string().min(3),
  telegramChatId: z.number().optional()
});

export type CreateIdeaInput = z.infer<typeof createIdeaInputSchema>;

export const workerJobSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("run-pipeline"),
    taskId: z.string()
  }),
  z.object({
    kind: z.literal("github-pr"),
    taskId: z.string(),
    devOutput: backendDevOutputSchema
  })
]);

export type WorkerJob = z.infer<typeof workerJobSchema>;
