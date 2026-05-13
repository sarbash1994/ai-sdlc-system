import OpenAI from 'openai';
import { ZodSchema } from 'zod';
import { validateJson } from '@ai-sdlc/validation';

const openai = new OpenAI();

export interface RunAgentOptions<T> {
  systemPrompt: string;
  userInput: string;
  schema: ZodSchema<T>;
  maxRetries?: number;
}

export async function runAgent<T>({
  systemPrompt,
  userInput,
  schema,
  maxRetries = 3
}: RunAgentOptions<T>): Promise<T> {
  let attempts = 0;
  let currentInput = userInput;

  const finalSystemPrompt = `${systemPrompt}\n\nYou MUST return only valid JSON that matches the required schema. Do NOT wrap it in markdown code blocks.`;

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: 'system', content: finalSystemPrompt },
    { role: 'user', content: currentInput }
  ];

  while (attempts < maxRetries) {
    attempts++;
    
    const response = await openai.chat.completions.create({
      model: "gpt-4.1",
      messages,
      temperature: attempts === 1 ? 0.7 : 0,
    });

    const content = response.choices[0]?.message?.content || "";

    try {
      return validateJson(content, schema);
    } catch (error: any) {
      if (attempts >= maxRetries) {
        throw new Error(`Agent failed to return valid output after ${maxRetries} attempts. Last error: ${error.message}`);
      }
      
      messages.push({ role: 'assistant', content });
      messages.push({ 
        role: 'user', 
        content: `Your previous response was invalid JSON. Fix it strictly according to schema. Error: ${error.message}` 
      });
    }
  }

  throw new Error("Unexpected end of runAgent");
}
