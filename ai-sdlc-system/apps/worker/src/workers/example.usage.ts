import { z } from 'zod';
import { runAgent } from '@ai-sdlc/llm';
import { getCodeContext } from '@ai-sdlc/rag';
import { runGithubWorker } from './github.worker.js';
import { runQaWorker } from './qa.worker.js';

// Example Schema for a feature implementation
const DevOutputSchema = z.object({
  branch: z.string(),
  changes: z.array(z.object({
    file: z.string(),
    diff: z.string()
  })),
  notes: z.string()
});

async function runDevPipelineExample(idea: string, repoUrl: string) {
  console.log("1. Gathering code context (RAG)...");
  const context = await getCodeContext(idea, { repoPath: process.cwd(), maxTokens: 4000 });

  console.log("2. Running Dev Agent...");
  const devOutput = await runAgent({
    systemPrompt: "You are a Senior Backend Engineer. Implement the requested feature as unified diffs.",
    userInput: `Task: ${idea}\n\nCode Context:\n${context}`,
    schema: DevOutputSchema,
    maxRetries: 3
  });

  console.log("Agent output received. Validated by Zod.");
  console.log(`Planned branch: ${devOutput.branch}`);
  
  console.log("3. Executing GitHub Worker to apply changes...");
  try {
    const prResult = await runGithubWorker({
      branch: devOutput.branch,
      changes: devOutput.changes,
      repoUrl: repoUrl
    });
    console.log(prResult);
  } catch (err: any) {
    console.error("GitHub Worker failed:", err.message);
  }

  console.log("4. Executing QA Worker (Playwright via Docker)...");
  try {
    const qaResult = await runQaWorker({
      tests: [
        {
          name: 'Verify API Endpoint',
          steps: ['Navigate to /api/health', 'Check status code'],
          expected: ['Status code is 200']
        }
      ],
      repoUrl: repoUrl
    });
    console.log(`QA Passed: ${qaResult.passed}, Failed: ${qaResult.failed}`);
  } catch (err: any) {
    console.error("QA Worker failed:", err.message);
  }
}

// runDevPipelineExample("Add a health check endpoint", "https://github.com/my-org/my-repo.git").catch(console.error);
