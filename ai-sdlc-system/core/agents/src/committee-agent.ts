import OpenAI from "openai";
import type { SDLCTask, CommitteeMessage } from "@ai-sdlc/types";

async function notify(chatId: number, token: string, agentName: string, message: string, vote: string) {
  if (!chatId || !token) return;
  const emoji = vote === "approve" ? "✅" : (vote === "reject" ? "❌" : "💬");
  const text = `*${agentName}* [${emoji}]:\n${message}`;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
    });
  } catch (err) {
    console.error("[Committee] Failed to notify Telegram:", err);
  }
}

export async function runCommitteeDebate(params: {
  client: OpenAI;
  model: string;
  task: SDLCTask;
  telegramChatId?: number;
  telegramBotToken?: string;
}): Promise<{
  consensusReached: boolean;
  discussion: CommitteeMessage[];
}> {
  const { client, model, task, telegramChatId, telegramBotToken } = params;
  
  if (!task.pmOutput) throw new Error("Missing PM output for Committee Stage");

  const pmPlan = JSON.stringify(task.pmOutput, null, 2);
  const idea = task.idea;

  const discussion: CommitteeMessage[] = [...(task.committeeDiscussion || [])];
  
  // If already reached consensus recently, just return
  if (discussion.length >= 2 && discussion.slice(-2).every(m => m.vote === "approve")) {
      return { consensusReached: true, discussion };
  }

  const agents = [
    {
      name: "Backend Dev",
      role: "You are the Lead Backend Developer. Your goal is to review the PM plan and ensure the technical architecture is robust, scalable, and secure. If you see any flaws, missing details, or better technical approaches, reject or discuss. If the plan and previous messages look perfect to start coding, approve."
    },
    {
      name: "QA Automation",
      role: "You are the Lead QA Automation Engineer. Your goal is to review the PM plan and ensure all edge cases are testable and covered. If there are missing edge cases or untestable requirements, reject or discuss. If it's perfect, approve."
    }
  ];

  let rounds = 0;
  let consensusReached = false;

  while (rounds < 5) {
    rounds++;
    let currentRoundApprovals = 0;

    for (const agent of agents) {
      const historyText = discussion.map(m => `[${m.agent} - ${m.vote.toUpperCase()}]: ${m.message}`).join("\n\n");
      
      const systemPrompt = `${agent.role}
You are participating in an architecture committee debate.
Here is the original task idea from the customer:
"${idea}"

Here is the PM's proposed plan:
${pmPlan}

Here is the current discussion history:
${historyText || "No discussion yet. You are the first to speak."}

Respond in JSON format:
{
  "message": "Your response to the plan and the discussion.",
  "vote": "approve" | "reject" | "discuss"
}

If you agree with the current plan and previous messages, vote "approve".
If you strongly disagree, vote "reject".
If you just have a question or a suggestion, vote "discuss".
Keep your message concise, constructive, and clear. IMPORTANT: Please write your message in Russian.`;

      let parsed: any = {};
      try {
        const response = await client.chat.completions.create({
          model,
          messages: [{ role: "system", content: systemPrompt }],
          response_format: { type: "json_object" }
        });

        const content = response.choices[0]?.message?.content || "{}";
        parsed = JSON.parse(content);
      } catch (err) {
        console.error("[Committee] Failed to query LLM:", err);
        parsed = { message: "Internal error during debate", vote: "discuss" };
      }
      
      const newMessage: CommitteeMessage = {
        agent: agent.name,
        message: parsed.message || "",
        vote: ["approve", "reject", "discuss"].includes(parsed.vote) ? parsed.vote : "discuss"
      };

      discussion.push(newMessage);
      
      if (telegramChatId && telegramBotToken) {
        await notify(telegramChatId, telegramBotToken, newMessage.agent, newMessage.message, newMessage.vote);
      }

      if (newMessage.vote === "approve") {
        currentRoundApprovals++;
      }
    }

    if (currentRoundApprovals === agents.length) {
      consensusReached = true;
      break;
    }
  }

  return { consensusReached, discussion };
}
