import OpenAI from "openai";
import type { z } from "zod";

type JsonAgentOptions<TSchema extends z.ZodTypeAny> = {
  client: OpenAI;
  model: string;
  schema: TSchema;
  systemPrompt: string;
  userPrompt: string;
  agentName: string;
};

export async function runJsonAgent<TSchema extends z.ZodTypeAny>(
  options: JsonAgentOptions<TSchema>
): Promise<z.infer<TSchema>> {
  const response = await options.client.chat.completions.create({
    model: options.model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${options.systemPrompt}\nReturn only valid JSON. Do not include markdown.`
      },
      { role: "user", content: options.userPrompt }
    ],
    temperature: 0.2
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error(`${options.agentName} returned no content`);
  }

  const parsed = JSON.parse(content) as unknown;
  return options.schema.parse(parsed);
}
