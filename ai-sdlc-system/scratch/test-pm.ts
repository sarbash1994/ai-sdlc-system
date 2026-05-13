import { loadConfig } from "../packages/config/src/index.js";
import { JsonFileTaskStore } from "../core/orchestrator/src/task-store.js";
import { PipelineOrchestrator } from "../core/orchestrator/src/orchestrator.js";
import { EmptyRetriever } from "../core/memory/src/index.js";

const config = loadConfig();
const taskStore = new JsonFileTaskStore("storage/tasks.json");
const orchestrator = new PipelineOrchestrator(config, taskStore, new EmptyRetriever());

const taskId = "task_1778706023068_dbdrua";

console.log(`Starting debug run for task ${taskId}...`);

orchestrator.runMvpPipeline(taskId)
  .then(task => {
    console.log("Pipeline finished successfully!");
    console.log("Current Stage:", task.currentStage);
    console.log("Status:", task.status);
  })
  .catch(err => {
    console.error("Pipeline failed with error:");
    console.error(err);
  });
