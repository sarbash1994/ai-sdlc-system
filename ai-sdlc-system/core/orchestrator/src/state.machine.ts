import { PipelineStage } from "./types.js";

export const transitions: Record<PipelineStage, PipelineStage> = {
  [PipelineStage.IDEA]: PipelineStage.BA,
  [PipelineStage.BA]: PipelineStage.PM,
  [PipelineStage.PM]: PipelineStage.DEV,
  [PipelineStage.DEV]: PipelineStage.QA_AUTO,
  [PipelineStage.QA_AUTO]: PipelineStage.QA_MANUAL,
  [PipelineStage.QA_MANUAL]: PipelineStage.DEVOPS,
  [PipelineStage.DEVOPS]: PipelineStage.DONE,
  [PipelineStage.DONE]: PipelineStage.DONE,
  [PipelineStage.FAILED]: PipelineStage.FAILED
};
