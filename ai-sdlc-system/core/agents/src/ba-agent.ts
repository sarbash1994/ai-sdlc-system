import OpenAI from "openai";
import { baOutputSchema, type BAOutput } from "@ai-sdlc/types";
import { runJsonAgent } from "./json-agent.js";

export async function runBAAgent(params: {
  client: OpenAI;
  model: string;
  idea: string;
}): Promise<BAOutput> {
  return runJsonAgent({
    client: params.client,
    model: params.model,
    schema: baOutputSchema,
    agentName: "BA Agent",
    systemPrompt:
      "You are a Business Analyst agent. You analyze raw product ideas and produce structured requirements, user stories, and edge cases. You never execute actions.",
    userPrompt: `Analyze this idea for implementation:\n\n${params.idea}\n\nRequired JSON shape: {"business_requirements":[],"user_stories":[],"edge_cases":[]}`
  });
}
