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
      "You are a backend developer agent. You produce implementation diffs only, never full files, never shell execution. Diffs must be unified git patches that can be applied by an isolated worker.",
    userPrompt: `Backend task:\n${JSON.stringify(params.task, null, 2)}\n\nRelevant code context:\n${params.codeContext}\n\nUse branch: feature/${params.branchHint}\n\nRequired JSON shape: {"branch":"feature/...","changes":[{"file":"","diff":"","rationale":""}],"commands":[]}`
  });
}
