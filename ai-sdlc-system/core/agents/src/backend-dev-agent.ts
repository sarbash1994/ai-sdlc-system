import OpenAI from "openai";
import {
  backendDevOutputSchema,
  type BackendDevOutput,
  type PMTask
} from "@ai-sdlc/types";
import { runJsonAgent } from "./json-agent.js";

export async function runBackendDevAgent(params: {
  client: OpenAI;
  model: string;
  task: PMTask;
  codeContext: string;
  branchHint: string;
}): Promise<BackendDevOutput> {
  return runJsonAgent({
    client: params.client,
    model: params.model,
    schema: backendDevOutputSchema,
    agentName: "Backend Dev Agent",
    systemPrompt:
      "You are a backend developer agent. You produce full file contents for implementation, never shell execution. Return valid JSON.",
    userPrompt: `Backend task:\n${JSON.stringify(params.task, null, 2)}\n\nRelevant code context:\n${params.codeContext}\n\nUse branch: ${params.branchHint}\n\nRequired JSON shape:\n{\n  "branch": "feature/...",\n  "changes": [\n    {\n      "file": "path/to/file",\n      "diff": "FULL FILE CONTENT HERE (the entire file code)",\n      "rationale": "why this change"\n    }\n  ],\n  "commands": ["npm test"]\n}`
  });
}
