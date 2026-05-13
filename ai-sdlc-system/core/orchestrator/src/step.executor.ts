import { PipelineStage, type PipelineTask } from "./types.js";
import { runAgent } from "@ai-sdlc/llm";
import { getCodeContext } from "@ai-sdlc/rag";
import { 
  BaOutputSchema, PmOutputSchema, DevOutputSchema, 
  QaAutoOutputSchema, QaManualOutputSchema 
} from "./schemas.js";
import * as fs from "fs";
import * as path from "path";

export class StepExecutor {
  private getPrompt(name: string): string {
    return fs.readFileSync(path.join(process.cwd(), `data/prompts/${name}.md`), 'utf-8');
  }

  async execute(stage: PipelineStage, task: PipelineTask) {
    switch (stage) {
      case PipelineStage.BA:
        return runAgent({
          systemPrompt: this.getPrompt('ba'),
          userInput: `Idea: ${task.idea}`,
          schema: BaOutputSchema
        });

      case PipelineStage.PM:
        return runAgent({
          systemPrompt: this.getPrompt('pm'),
          userInput: `BA Output:\n${JSON.stringify(task.data[PipelineStage.BA], null, 2)}`,
          schema: PmOutputSchema
        });

      case PipelineStage.DEV:
        return this.handleDev(task);

      case PipelineStage.QA_AUTO:
        return runAgent({
          systemPrompt: this.getPrompt('qa-automation'),
          userInput: `PM Tasks:\n${JSON.stringify(task.data[PipelineStage.PM], null, 2)}`,
          schema: QaAutoOutputSchema
        });

      case PipelineStage.QA_MANUAL:
        return runAgent({
          systemPrompt: this.getPrompt('qa-manual'),
          userInput: `PM Tasks:\n${JSON.stringify(task.data[PipelineStage.PM], null, 2)}\nQA Auto:\n${JSON.stringify(task.data[PipelineStage.QA_AUTO], null, 2)}`,
          schema: QaManualOutputSchema
        });

      case PipelineStage.DEVOPS:
        return runAgent({
          systemPrompt: this.getPrompt('devops'),
          userInput: `PM Tasks:\n${JSON.stringify(task.data[PipelineStage.PM], null, 2)}`,
          schema: DevOutputSchema
        });

      default:
        return null;
    }
  }

  private async handleDev(task: PipelineTask) {
    const pmOutput = task.data[PipelineStage.PM];
    if (!pmOutput || !pmOutput.tasks) {
      throw new Error("PM Output and tasks are required for DEV stage");
    }

    const tasks = pmOutput.tasks;

    const results = await Promise.all(
      tasks.map(async (t: any) => {
        const context = await getCodeContext(t.description, { repoPath: process.cwd(), maxTokens: 4000 });
        
        let promptName = 'backend-dev';
        if (t.type === 'frontend') promptName = 'frontend-dev';
        else if (t.type === 'mobile') promptName = 'mobile-dev';
        else if (t.type === 'devops') promptName = 'devops';

        const result = await runAgent({
          systemPrompt: this.getPrompt(promptName),
          userInput: `Task: ${JSON.stringify(t, null, 2)}\n\nCode Context:\n${context}`,
          schema: DevOutputSchema
        });

        return { type: t.type, result };
      })
    );

    return results;
  }
}
