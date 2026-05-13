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

  const content = response.choices[0]?.message?.content || "{}";
  const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
  console.log(`[Agent: ${options.agentName}] Raw output:`, cleaned);

  try {
    const json = JSON.parse(cleaned);
    return options.schema.parse(json);
  } catch (err) {
    console.error(`[Agent: ${options.agentName}] Validation failed for output:`, cleaned);
    throw err;
  }
}
