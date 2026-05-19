import OpenAI from "openai";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

export type RetrievedContext = {
  source: string;
  content: string;
  score: number;
};

export interface Retriever {
  retrieve(query: string): Promise<RetrievedContext[]>;
}

export class EmptyRetriever implements Retriever {
  async retrieve(): Promise<RetrievedContext[]> {
    return [];
  }
}

export class LLMCodeRetriever implements Retriever {
  constructor(
    private readonly client: OpenAI,
    private readonly model: string
  ) {}

  async retrieve(query: string): Promise<RetrievedContext[]> {
    try {
      console.log(`[LLMCodeRetriever] Finding relevant files for query: "${query}"`);
      const files = await this.listFiles(".");
      if (files.length === 0) {
        return [];
      }

      const prompt = `You are a code retrieval system. We have a TypeScript/JavaScript monorepo.
Given a task description, you need to select the files that are most relevant to understanding or implementing the task.

Task description:
"${query}"

Available files in the workspace:
${files.map(f => `- ${f}`).join("\n")}

Respond with a JSON object containing an array of the top 3-5 most relevant file paths to check.
Required JSON format:
{
  "relevantFiles": ["path/to/file1.ts", "path/to/file2.js"]
}`;

      const response = await this.client.chat.completions.create({
        model: this.model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "You are a software engineer assistant that identifies relevant files in a repository. Return only valid JSON." },
          { role: "user", content: prompt }
        ],
        temperature: 0.1
      });

      const content = response.choices[0]?.message?.content || "{}";
      const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
      const parsed = JSON.parse(cleaned);
      const selectedFiles: string[] = parsed.relevantFiles || [];
      console.log(`[LLMCodeRetriever] Selected files:`, selectedFiles);

      const results: RetrievedContext[] = [];
      for (const file of selectedFiles) {
        if (files.includes(file)) {
          try {
            const fileContent = await readFile(join(process.cwd(), file), "utf8");
            results.push({
              source: file,
              content: fileContent,
              score: 1.0
            });
          } catch (err) {
            console.error(`[LLMCodeRetriever] Failed to read selected file ${file}:`, err);
          }
        }
      }

      return results;
    } catch (err) {
      console.error("[LLMCodeRetriever] Retrieve failed, falling back to empty:", err);
      return [];
    }
  }

  private async listFiles(dir: string): Promise<string[]> {
    const baseDir = process.cwd();
    const absoluteDir = join(baseDir, dir);
    const results: string[] = [];
    
    async function scan(current: string) {
      const entries = await readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = join(current, entry.name);
        const relPath = fullPath.slice(baseDir.length + 1);
        if (entry.isDirectory()) {
          if (
            entry.name === "node_modules" ||
            entry.name === ".git" ||
            entry.name === "dist" ||
            entry.name === "build" ||
            entry.name === "storage" ||
            entry.name === ".next"
          ) {
            continue;
          }
          await scan(fullPath);
        } else {
          const ext = entry.name.split(".").pop() || "";
          if (["ts", "js", "json", "tsx", "jsx", "md", "mjs", "css"].includes(ext)) {
            results.push(relPath);
          }
        }
      }
    }

    try {
      await scan(absoluteDir);
    } catch (err) {
      console.error(`[LLMCodeRetriever] Failed to scan dir ${dir}:`, err);
    }
    return results;
  }
}

export function formatRetrievedContext(items: RetrievedContext[]): string {
  if (items.length === 0) {
    return "No indexed code context is available yet.";
  }

  return items
    .map((item) => `SOURCE: ${item.source}\nSCORE: ${item.score}\n${item.content}`)
    .join("\n\n---\n\n");
}
