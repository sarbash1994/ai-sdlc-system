console.log(">>> WORKER BOOTSTRAP STARTED");

async function main() {
  console.log(">>> LOADING CONFIG MODULE...");
  const { loadConfig } = await import("../../../packages/config/src/index.js");
  const config = loadConfig();
  console.log(">>> CONFIG READY.");

  const logger = {
    info: (...args: any[]) => console.log("[INFO]", ...args),
    error: (...args: any[]) => console.error("[ERROR]", ...args),
    warn: (...args: any[]) => console.warn("[WARN]", ...args),
    debug: (...args: any[]) => console.debug("[DEBUG]", ...args),
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

  const { LLMCodeRetriever } = await import("../../../core/memory/src/index.js");
  const { default: OpenAI } = await import("openai");
  
  const taskStore = new JsonFileTaskStore("storage/tasks.json");
  const openAIClient = new OpenAI({ apiKey: config.openaiApiKey });
  const retriever = new LLMCodeRetriever(openAIClient, config.openaiModel);
  const orchestrator = new PipelineOrchestrator(config, taskStore, retriever);

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
    
    let reply_markup = undefined;

    if (stage === "BA_ANALYSIS") {
      if (status === "waiting_for_approval") {
        if (task.baOutput) {
          emoji = "🔍";
          message = `${emoji} *BA Requirements Proposal* for task \`${task.id}\`\n\n` +
            `*Business Requirements:*\n` +
            task.baOutput.business_requirements.map((r) => `- ${r}`).join("\n") +
            `\n\n*User Stories:*\n` +
            task.baOutput.user_stories.map((us) => {
              if (typeof us === "string") return `- ${us}`;
              return `- As an *${us.role || "User"}*, I want to *${us.goal}* ${us.benefit ? `so that I can *${us.benefit}*` : ""}`;
            }).join("\n") +
            `\n\n*Edge Cases:*\n` +
            task.baOutput.edge_cases.map((ec) => `- ${ec}`).join("\n") +
            `\n\n*Assumptions:*\n` +
            task.baOutput.assumptions.map((a) => `- ${a}`).join("\n") +
            `\n\n💬 Reply to this message to discuss or modify the requirements, or use the buttons below to proceed.`;
            
          reply_markup = {
            inline_keyboard: [[
              { text: "Approve", callback_data: `approve_${task.id}` },
              { text: "Decline", callback_data: `decline_${task.id}` }
            ]]
          };
        } else if (task.clarifyingQuestions?.length) {
          emoji = "❓";
          message = `${emoji} *Clarifying Questions for Task* \`${task.id}\`\n\n` +
            `The Business Analyst needs more details before planning:\n\n` +
            task.clarifyingQuestions.map((q, idx) => `*${idx + 1}.* ${q}`).join("\n") +
            `\n\nPlease reply directly to this message or use \`/answer <your responses>\` to continue.`;
        }
      } else if (status === "running") {
        emoji = "🔍";
        message = `${emoji} *Business Analysis Started* for task \`${task.id}\`...`;
      } else if (status === "done") {
        emoji = "🔍";
        message = `${emoji} *Business Analysis Completed* for task \`${task.id}\`.\nRequirements generated.`;
      }
    } else if (stage === "PM_PLANNING") {
      if (status === "running") {
        emoji = "📋";
        message = `${emoji} *Project Planning Started* for task \`${task.id}\`...`;
      } else if (status === "waiting_for_approval" && task.pmOutput?.tasks?.length) {
        emoji = "📋";
        message = `${emoji} *PM Planning Proposal* for task \`${task.id}\`\n\n` +
          `*Planned Tasks:*\n` +
          task.pmOutput.tasks.map((t, idx) => {
            const effort = t.estimated_effort ? ` (Effort: *${t.estimated_effort}*)` : "";
            return `*${idx + 1}.* [${t.type.toUpperCase()}] *${t.title || t.description}*${effort}\n   _${t.description}_`;
          }).join("\n\n") +
          `\n\n✅ Use the buttons below to approve the plan and begin development implementation.`;
          
        reply_markup = {
          inline_keyboard: [[
            { text: "Approve", callback_data: `approve_${task.id}` },
            { text: "Decline", callback_data: `decline_${task.id}` }
          ]]
        };
      }
    } else if (stage === "DEV_IMPLEMENTATION") {
      if (status === "running") {
        emoji = "🛠️";
        message = `${emoji} *Backend Development Started* for task \`${task.id}\`...`;
      } else if (status === "done") {
        emoji = "💻";
        message = `${emoji} *Code Changes Implemented* for task \`${task.id}\`!\nPull request has been created.`;
      }
    } else if (stage === "DONE" && status === "done") {
      emoji = "🎉";
      message = `${emoji} *SDLC Pipeline Completed!* for task \`${task.id}\`\nAll stages finished successfully.`;
    }

    if (task.pullRequestUrl) {
        message += `\n\n*GitHub PR:* [View Changes](${task.pullRequestUrl})`;
    }
    
    message += `\n\n_${new Date().toLocaleString()}_`;
    
    console.log(`>>> Sending Telegram notification for task ${task.id} (Stage: ${stage}, Status: ${status}) to ${task.telegramChatId}...`);
    try {
      const bodyPayload: any = { chat_id: task.telegramChatId, text: message, parse_mode: "Markdown" };
      if (reply_markup) {
        bodyPayload.reply_markup = reply_markup;
      }

      const res = await fetch(`https://api.telegram.org/bot${config.telegramBotToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyPayload)
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
