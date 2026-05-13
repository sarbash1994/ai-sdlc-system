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
    userPrompt: `Analyze this idea for implementation:\n\n${params.idea}\n\nRequired JSON shape:\n{\n  "business_requirements": ["string"],\n  "user_stories": [\n    {\n      "role": "string (e.g. User, Admin)",\n      "goal": "string (what they want to do)",\n      "benefit": "string (why they want to do it)"\n    }\n  ],\n  "edge_cases": ["string"],\n  "assumptions": ["string"]\n}`
  });
}
