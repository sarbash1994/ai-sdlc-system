import { z, ZodSchema } from 'zod';

export function validateJson<T>(jsonString: string, schema: ZodSchema<T>): T {
  try {
    const parsed = JSON.parse(jsonString);
    return schema.parse(parsed);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      const issues = error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
      throw new Error(`Schema validation failed: ${issues}`);
    }
    throw new Error(`Invalid JSON: ${error.message}`);
  }
}
