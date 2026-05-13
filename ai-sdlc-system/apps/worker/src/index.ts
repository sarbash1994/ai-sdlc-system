console.log(">>> WORKER BOOTSTRAP STARTED");

async function main() {
  console.log(">>> LOADING CONFIG MODULE...");
  const { loadConfig } = await import("../../../packages/config/src/index.js");
  const config = loadConfig();
  console.log(">>> CONFIG READY.");

  const logger = {
    info: (...args) => console.log("[INFO]", ...args),
    error: (...args) => console.error("[ERROR]", ...args),
    warn: (...args) => console.warn("[WARN]", ...args),
    debug: (...args) => console.debug("[DEBUG]", ...args),
  };

  console.log(">>> LOADING TASK STORE...");
  const { JsonFileTaskStore } = await import("../../../core/orchestrator/src/task-store.js");
  console.log(">>> TASK STORE LOADED.");

  console.log(">>> LOADING QUEUE...");
  const { claimNextLocalJob, completeLocalJob, failLocalJob, recoverStuckJobs } = await import("../../../core/orchestrator/src/queue.js");
  console.log(">>> QUEUE LOADED.");

  console.log(">>> LOADING ORCHESTRATOR CLASS...");
  const { PipelineOrchestrator } = await import("../../../core/orchestrator/src/orchestrator.js");
  console.log(">>> ORCHESTRATOR CLASS LOADED.");

  console.log(">>> LOADING TYPES MODULE...");
  const { workerJobSchema } = await import("../../../packages/types/src/index.js");
  console.log(">>> TYPES MODULE LOADED.");

  const { EmptyRetriever } = await import("../../../core/memory/src/index.js");
  
  const taskStore = new JsonFileTaskStore("storage/tasks.json");
  const orchestrator = new PipelineOrchestrator(config, taskStore, new EmptyRetriever());

  console.log(">>> ALL INITIALIZED. STARTING POLLING...");

  orchestrator.addListener(async (task) => {
    if (!task.telegramChatId || !config.telegramBotToken) {
        console.log(`>>> Skipping notification for task ${task.id}: Missing chatId (${task.telegramChatId}) or Token (${!!config.telegramBotToken})`);
        return;
    }
    const stage = task.currentStage;
    const status = task.status;
    let emoji = "⏳";
    if (status === "done") emoji = "✅";
    if (status === "failed") emoji = "❌";
    if (status === "running") emoji = "🚀";
    let message = `${emoji} *Task Update*\n\n*ID:* \`${task.id}\`\n*Stage:* \`${stage}\`\n*Status:* \`${status}\``;
    
    if (task.pullRequestUrl) {
        message += `\n\n*GitHub PR:* [View Changes](${task.pullRequestUrl})`;
    }
    
    message += `\n\n_${new Date().toLocaleString()}_`;
    
    console.log(`>>> Sending Telegram notification for task ${task.id} (Stage: ${stage}, Status: ${status}) to ${task.telegramChatId}...`);
    try {
      const res = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: task.telegramChatId, text: message, parse_mode: "Markdown" })
      });
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[ERROR] Telegram API returned ${res.status}: ${errorText}`);
      } else {
        console.log(`[SUCCESS] Telegram notification sent for task ${task.id}`);
      }
    } catch (err) {
      console.error("[ERROR] Telegram fetch failed:", err);
    }
  });

  async function processQueue() {
    const job = await claimNextLocalJob();
    if (!job) return;
    console.log(`[Worker] Processing job ${job.id} for task ${job.data.taskId}`);
    try {
      const data = workerJobSchema.parse(job.data);
      await orchestrator.runMvpPipeline(data.taskId);
      await completeLocalJob(job.id);
    } catch (error) {
      console.error("[Worker] Job failed:", error);
      await failLocalJob(job.id, error);
    }
  }

  setInterval(() => {
    processQueue().catch(err => console.error("[Worker] Loop error:", err));
  }, 2000);

  await recoverStuckJobs();
  await processQueue();
}

main().catch(err => {
  console.error(">>> FATAL WORKER ERROR:", err);
});
