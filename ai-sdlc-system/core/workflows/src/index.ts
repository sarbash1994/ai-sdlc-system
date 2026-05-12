import type { PipelineStage } from "@ai-sdlc/types";

export const pipelineStages: PipelineStage[] = [
  "IDEA",
  "BA_ANALYSIS",
  "PM_PLANNING",
  "DEV_IMPLEMENTATION",
  "QA_AUTOMATION",
  "QA_MANUAL",
  "DEVOPS_DEPLOY",
  "DONE"
];

export const mvpPipelineStages: PipelineStage[] = [
  "IDEA",
  "BA_ANALYSIS",
  "PM_PLANNING",
  "DEV_IMPLEMENTATION",
  "DONE"
];

export function nextMvpStage(stage: PipelineStage): PipelineStage | null {
  const index = mvpPipelineStages.indexOf(stage);
  if (index === -1 || index === mvpPipelineStages.length - 1) {
    return null;
  }

  return mvpPipelineStages[index + 1] ?? null;
}
