import { ZodSchema } from 'zod';
export interface RunAgentOptions<T> {
    systemPrompt: string;
    userInput: string;
    schema: ZodSchema<T>;
    maxRetries?: number;
}
export declare function runAgent<T>({ systemPrompt, userInput, schema, maxRetries }: RunAgentOptions<T>): Promise<T>;
//# sourceMappingURL=runAgent.d.ts.map