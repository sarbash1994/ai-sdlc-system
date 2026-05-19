import OpenAI from "openai";
import { z } from "zod";
import { baOutputSchema, type BAOutput } from "@ai-sdlc/types";
import { runJsonAgent } from "./json-agent.js";

export const baQuestionsSchema = z.object({
  questions: z.array(z.string()).min(1)
});

export type BAQuestions = z.infer<typeof baQuestionsSchema>;

export async function runBAQuestionsAgent(params: {
  client: OpenAI;
  model: string;
  idea: string;
}): Promise<BAQuestions> {
  return runJsonAgent({
    client: params.client,
    model: params.model,
    schema: baQuestionsSchema,
    systemPrompt: "You are a Business Analyst agent. Your goal is to ask clarifying questions about a product idea to define clear requirements. IMPORTANT: Write all questions in Russian.",
    agentName: "BA Questions Agent",
    userPrompt: `We need to implement this idea:\n\n${params.idea}\n\nBefore analyzing it, as a Business Analyst, formulate 2-3 clarifying questions for the user to understand the exact scope, requirements, or details needed to successfully implement this idea. Write the questions in Russian.\n\nRequired JSON shape:\n{\n  "questions": ["string"]\n}`
  });
}

export async function runBAAgent(params: {
  client: OpenAI;
  model: string;
  idea: string;
  answers?: string;
}): Promise<BAOutput> {
  const contextPrompt = params.answers 
    ? `Analyze this idea for implementation:\n\nIdea:\n${params.idea}\n\nClarifying Answers from User:\n${params.answers}`
    : `Analyze this idea for implementation:\n\n${params.idea}`;

  return runJsonAgent({
    client: params.client,
    model: params.model,
    schema: baOutputSchema,
    systemPrompt: "You are a Business Analyst agent. Your goal is to analyze the product idea and user answers to detail requirements, user stories, edge cases, and assumptions. IMPORTANT: You must write all requirements, user stories, edge cases, and assumptions in Russian.",
    agentName: "BA Agent",
    userPrompt: `${contextPrompt}\n\nRequired JSON shape:\n{\n  "business_requirements": ["string"],\n  "user_stories": [\n    {\n      "role": "string (e.g. User, Admin)",\n      "goal": "string (what they want to do)",\n      "benefit": "string (why they want to do it)"\n    }\n  ],\n  "edge_cases": ["string"],\n  "assumptions": ["string"]\n}`
  });
}
