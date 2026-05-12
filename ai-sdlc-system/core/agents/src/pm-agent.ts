import OpenAI from "openai";
import { pmOutputSchema, type BAOutput, type PMOutput } from "@ai-sdlc/types";
import { runJsonAgent } from "./json-agent.js";

export async function runPMAgent(params: {
  client: OpenAI;
  model: string;
  baOutput: BAOutput;
}): Promise<PMOutput> {
  return runJsonAgent({
    client: params.client,
    model: params.model,
    schema: pmOutputSchema,
    agentName: "PM Agent",
    systemPrompt:
      "You are a Project Manager agent. Convert BA analysis into implementation tasks. For the MVP, include at least one backend task when backend work is plausible. You never execute actions.",
    userPrompt: `Create implementation tasks from this BA output:\n\n${JSON.stringify(params.baOutput, null, 2)}\n\nRequired JSON shape: {"tasks":[{"type":"frontend|backend|mobile|devops","description":"","acceptance_criteria":[]}]}`
  });
}
