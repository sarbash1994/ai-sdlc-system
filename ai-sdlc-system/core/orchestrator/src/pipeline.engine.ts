import { logger } from "@ai-sdlc/logger";
import { PipelineStage, type PipelineTask, type ExecutionLayer } from "./types.js";
import { StepExecutor } from "./step.executor.js";
import { transitions } from "./state.machine.js";
import { TaskStore } from "./task-store.js"; 

export class PipelineEngine {
  constructor(
    private executor: StepExecutor,
    private taskStore: TaskStore,
    private executionLayer?: ExecutionLayer
  ) {}

  async run(task: PipelineTask) {
    logger.info({ taskId: task.id, stage: task.stage }, "Pipeline started");

    while (!this.isFinished(task)) {
      const stage = task.stage;

      // Idempotency: check if already completed
      if (task.history.find(h => h.stage === stage && h.result !== undefined)) {
        logger.info({ taskId: task.id, stage }, "Stage already executed, skipping");
        task.stage = transitions[stage];
        continue;
      }

      try {
        logger.info({ taskId: task.id, stage }, `Executing stage ${stage}`);
        const result = await this.executor.execute(stage, task);

        // Run execution layer logic
        if (this.executionLayer) {
          if (stage === PipelineStage.DEV && Array.isArray(result)) {
            logger.info({ taskId: task.id }, "Applying DEV stage diffs via Execution Layer");
            for (const r of result as any[]) {
              if (r.result?.branch && r.result?.changes) {
                await this.executionLayer.applyDevChanges(r.result.branch, r.result.changes, "local");
              }
            }
          }

          if (stage === PipelineStage.QA_AUTO && result && typeof result === 'object' && 'tests' in result) {
            logger.info({ taskId: task.id }, "Executing QA tests via Execution Layer");
            const qaResult = await this.executionLayer.runQaTests((result as any).tests, "local");
            logger.info({ taskId: task.id, qaResult }, "QA execution completed");
            (result as any).report = qaResult;
          }
        }

        // Save result
        task.data[stage] = result;
        task.history.push({
          stage,
          result,
          timestamp: Date.now()
        });

        // Transition to next stage
        task.stage = transitions[stage];
        
        // Persistence
        await this.persistTask(task);
      } catch (err: any) {
        logger.error({ taskId: task.id, stage, error: err.message }, "Stage failed");
        
        task.history.push({
          stage,
          error: err.message,
          timestamp: Date.now()
        });

        if (this.shouldRetry(task)) {
          task.retries += 1;
          await this.persistTask(task);
          logger.info({ taskId: task.id, stage, retries: task.retries }, "Retrying stage");
          await this.retryDelay();
          continue;
        }

        task.stage = PipelineStage.FAILED;
        await this.persistTask(task);
        break;
      }
    }

    logger.info({ taskId: task.id, finalStage: task.stage }, "Pipeline finished");
    return task;
  }

  private isFinished(task: PipelineTask) {
    return (
      task.stage === PipelineStage.DONE ||
      task.stage === PipelineStage.FAILED
    );
  }

  private shouldRetry(task: PipelineTask) {
    return task.retries < 3;
  }

  private async retryDelay() {
    await new Promise((r) => setTimeout(r, 2000));
  }

  private async persistTask(task: PipelineTask) {
    // Basic JSON stringify save via taskStore
    await this.taskStore.saveTask(task as any);
  }
}
