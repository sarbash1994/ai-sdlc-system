import { exec } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, cp, symlink, readFile, writeFile, readdir, rm, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import OpenAI from "openai";
import {
  qaAutomationOutputSchema,
  type QAAutomationOutput,
  type SDLCTask
} from "@ai-sdlc/types";

const execAsync = promisify(exec);

async function listFiles(dir: string, baseDir: string): Promise<string[]> {
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
        results.push(relPath);
      }
    }
  }
  await scan(absoluteDir);
  return results;
}

async function readAgentFile(filePath: string, baseDir: string): Promise<string> {
  const absolutePath = join(baseDir, filePath);
  return await readFile(absolutePath, "utf8");
}

async function writeAgentFile(filePath: string, content: string, baseDir: string): Promise<void> {
  const absolutePath = join(baseDir, filePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

async function editAgentFile(filePath: string, targetContent: string, replacementContent: string, baseDir: string): Promise<string> {
  const absolutePath = join(baseDir, filePath);
  const content = await readFile(absolutePath, "utf8");
  if (!content.includes(targetContent)) {
    throw new Error(`Target content not found in ${filePath}. Make sure targetContent matches EXACTLY, including all indentation and line endings.`);
  }
  const updatedContent = content.replace(targetContent, replacementContent);
  await writeFile(absolutePath, updatedContent, "utf8");
  return "File edited successfully.";
}

async function grepSearch(query: string, baseDir: string): Promise<string> {
  const files = await listFiles(".", baseDir);
  const results: string[] = [];
  for (const file of files) {
    try {
      const content = await readFile(join(baseDir, file), "utf8");
      const lines = content.split("\n");
      lines.forEach((line, idx) => {
        if (line.toLowerCase().includes(query.toLowerCase())) {
          results.push(`${file}:${idx + 1}: ${line.trim()}`);
        }
      });
    } catch (err) {
      // ignore
    }
  }
  return results.slice(0, 100).join("\n");
}

async function runCommand(command: string, baseDir: string): Promise<{ stdout: string; stderr: string }> {
  try {
    const { stdout, stderr } = await execAsync(command, { cwd: baseDir });
    return { stdout, stderr };
  } catch (err: any) {
    return {
      stdout: err.stdout || "",
      stderr: err.stderr || err.message || ""
    };
  }
}

const tools = [
  {
    type: "function" as const,
    function: {
      name: "list_files",
      description: "List all files in a directory recursively, excluding build/node_modules directories.",
      parameters: {
        type: "object",
        properties: {
          directory: {
            type: "string",
            description: "The directory to list files from (relative to project root). Default is '.'."
          }
        }
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "read_file",
      description: "Read the full contents of a file.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Path to the file relative to the project root."
          }
        },
        required: ["filePath"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "write_file",
      description: "Write content to a file (creates or overwrites the file).",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Path to the file relative to the project root."
          },
          content: {
            type: "string",
            description: "Full content to write to the file."
          }
        },
        required: ["filePath", "content"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "edit_file",
      description: "Replace a specific block of text in an existing file. This is preferred over write_file for modifying existing files.",
      parameters: {
        type: "object",
        properties: {
          filePath: {
            type: "string",
            description: "Path to the file relative to the project root."
          },
          targetContent: {
            type: "string",
            description: "The exact block of code in the file that needs to be replaced. Must match exactly including whitespace."
          },
          replacementContent: {
            type: "string",
            description: "The new code that will replace the targetContent."
          }
        },
        required: ["filePath", "targetContent", "replacementContent"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "grep_search",
      description: "Find occurrences of a pattern in the codebase files.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query (string pattern)."
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function" as const,
    function: {
      name: "run_command",
      description: "Execute a terminal command (e.g. 'npm test' or 'npm run build') in the project root to verify changes.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The command to run, e.g. 'npm test' or 'npm run build'."
          }
        },
        required: ["command"]
      }
    }
  }
];

export async function runQAAgent(params: {
  client: OpenAI;
  model: string;
  task: SDLCTask;
  codeContext: string;
}): Promise<QAAutomationOutput> {
  const tempDir = await mkdtemp(join(tmpdir(), "ai-sdlc-qa-agent-"));
  console.log(`[QA Agent] Sandboxing workspace in: ${tempDir}`);

  // Copy current workspace except node_modules/git/storage/temp directories
  await cp(process.cwd(), tempDir, {
    recursive: true,
    filter: (src) => {
      const name = src.toLowerCase();
      const isIgnored =
        name.includes("node_modules") ||
        name.includes(".git") ||
        name.includes("storage") ||
        name.includes("ai-sdlc-");
      return !isIgnored;
    }
  });

  // Apply the developer's changes so the QA agent is testing the new code
  if (params.task.backendDevOutput?.changes) {
    for (const change of params.task.backendDevOutput.changes) {
      await writeAgentFile(change.file, change.diff, tempDir);
    }
  }

  // Symlink node_modules to make workspace fully functional immediately
  try {
    await symlink(join(process.cwd(), "node_modules"), join(tempDir, "node_modules"));
  } catch (err) {
    console.warn("[QA Agent] Failed to symlink node_modules, continuing without it:", err);
  }

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: `You are an advanced QA Automation agent. You have access to tools to read, write, search, and run tests in an isolated workspace.
Your task is to write automated tests for the recently implemented feature.

Follow this process:
1. Use 'list_files' or 'grep_search' to explore the codebase and find the files modified by the developer.
2. Use 'read_file' to view the content of those files and understand the new logic.
3. Write automated tests (e.g., unit tests or integration tests) by using 'write_file' or 'edit_file' to create or modify test files (*.test.ts).
4. Run 'run_command' with 'npm test' or the appropriate test command to verify that your tests pass.
5. If tests fail, read the error output carefully, modify the test files or code, and run the command again.
6. Once tests pass and you are confident in your coverage, return the final output as a JSON object matching the required schema. Do NOT make any more tool calls after returning the final JSON.

The final JSON output must conform to this schema:
{
  "changes": [
    {
      "file": "relative/path/to/test/file.test.ts",
      "content": "FULL FILE CONTENT HERE",
      "rationale": "Description of what was tested and why"
    }
  ],
  "commands": ["npm test"]
}`
    },
    {
      "role": "user",
      "content": `Task idea:\n${params.task.idea}\n\nDeveloper changes summary:\n${params.task.backendDevOutput?.changes.map(c => c.file).join(", ") || "None"}\n\nRelevant code context:\n${params.codeContext}`
    }
  ];

  let turns = 0;
  const maxTurns = 20;

  try {
    while (turns < maxTurns) {
      turns++;
      const response = await params.client.chat.completions.create({
        model: params.model,
        messages,
        tools,
        tool_choice: "auto",
        response_format: { type: "json_object" }
      });

      const choice = response.choices[0];
      if (!choice) {
        throw new Error("No choices returned from OpenAI completion.");
      }
      const message = choice.message;

      // OpenAI API expects tool_calls to be typed correctly in history
      messages.push(message);

      if (message.tool_calls && message.tool_calls.length > 0) {
        console.log(`[QA Agent] Turn ${turns}: calling ${message.tool_calls.length} tools`);
        for (const toolCall of message.tool_calls) {
          const name = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          let result = "";

          try {
            if (name === "list_files") {
              const list = await listFiles(args.directory || ".", tempDir);
              result = JSON.stringify(list);
            } else if (name === "read_file") {
              result = await readAgentFile(args.filePath, tempDir);
            } else if (name === "write_file") {
              await writeAgentFile(args.filePath, args.content, tempDir);
              result = "File written successfully.";
            } else if (name === "edit_file") {
              result = await editAgentFile(args.filePath, args.targetContent, args.replacementContent, tempDir);
            } else if (name === "grep_search") {
              result = await grepSearch(args.query, tempDir);
            } else if (name === "run_command") {
              const cmdRes = await runCommand(args.command, tempDir);
              result = JSON.stringify(cmdRes);
            }
          } catch (err: any) {
            result = `Error: ${err.message}`;
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result
          });
        }
      } else {
        // No more tool calls, parse and return the final JSON response!
        const content = message.content || "{}";
        const cleaned = content.replace(/```json\n?|\n?```/g, "").trim();
        console.log(`[QA Agent] Final Turn output received.`);
        try {
          const json = JSON.parse(cleaned);
          const parsed = qaAutomationOutputSchema.parse(json);
          return parsed;
        } catch (err) {
          console.error(`[QA Agent] Schema validation failed:`, err);
          messages.push({
            role: "user",
            content: `Your final output did not conform to the schema: ${(err as Error).message}. Please correct it and output the valid JSON matching the schema.`
          });
        }
      }
    }
    throw new Error("QA Agent exceeded maximum execution turns.");
  } finally {
    // Always clean up the temporary workspace
    await rm(tempDir, { recursive: true, force: true }).catch((err) => {
      console.warn(`[QA Agent] Failed to clean up tempDir: ${tempDir}`, err);
    });
  }
}
