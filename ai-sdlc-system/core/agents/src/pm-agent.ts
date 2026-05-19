import OpenAI from "openai";
import { pmOutputSchema, type BAOutput, type PMOutput, type CommitteeMessage } from "@ai-sdlc/types";
import { runJsonAgent } from "./json-agent.js";

export async function runPMAgent(params: {
  client: OpenAI;
  model: string;
  baOutput: BAOutput;
  committeeDiscussion?: CommitteeMessage[];
}): Promise<PMOutput> {
  const committeeContext = params.committeeDiscussion && params.committeeDiscussion.length > 0
    ? `\n\nВНИМАНИЕ: Предыдущий план был отклонен Архитектурным Комитетом (Architecture Committee). Вот их замечания:\n${JSON.stringify(params.committeeDiscussion, null, 2)}\n\nВы ОБЯЗАНЫ учесть их критику и добавить нужные технические требования в новый план (например, кэширование, рейтлимиты и т.д.).`
    : "";

  return runJsonAgent({
    client: params.client,
    model: params.model,
    schema: pmOutputSchema,
    agentName: "PM Agent",
    systemPrompt:
      "You are a Project Manager agent. Convert BA analysis into implementation tasks and estimate the effort required for each task (e.g. in story points or hours). IMPORTANT: You must write all task titles, descriptions, and acceptance criteria in Russian. For the MVP, include at least one backend task when backend work is plausible. You never execute actions.",
    userPrompt: `Create implementation tasks from this BA output:\n\n${JSON.stringify(params.baOutput, null, 2)}${committeeContext}\n\nWrite all fields (title, description, acceptance_criteria) in Russian.\n\nRequired JSON shape: {"tasks":[{"type":"frontend|backend|mobile|devops","title":"Short Title","description":"","acceptance_criteria":[],"estimated_effort":"3 story points"}]}`
  });
}
