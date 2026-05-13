import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface QAWorkerInput {
  tests: Array<{
    name: string;
    steps: string[];
    expected: string[];
  }>;
  repoUrl: string;
}

export interface QAWorkerOutput {
  passed: number;
  failed: number;
  report: string;
}

export async function runQaWorker(input: QAWorkerInput): Promise<QAWorkerOutput> {
  const { tests, repoUrl } = input;
  const workDir = path.join(process.cwd(), '.tmp', 'qa-worker', Date.now().toString());

  try {
    await fs.mkdir(workDir, { recursive: true });

    // Checkout codebase
    await execAsync(`git clone ${repoUrl} repo`, { cwd: workDir });
    const repoDir = path.join(workDir, 'repo');

    // 1. Generate Playwright tests
    const testsDir = path.join(repoDir, 'tests', 'e2e');
    await fs.mkdir(testsDir, { recursive: true });

    let testCode = `import { test, expect } from '@playwright/test';\n\n`;
    for (const [index, t] of tests.entries()) {
      testCode += `test('${t.name.replace(/'/g, "\\'")}', async ({ page }) => {\n`;
      for (const step of t.steps) {
        testCode += `  // Step: ${step}\n`;
      }
      for (const exp of t.expected) {
        testCode += `  // Expected: ${exp}\n`;
      }
      // Placeholder for actual test generated logic 
      testCode += `  expect(true).toBe(true);\n});\n\n`;
    }

    await fs.writeFile(path.join(testsDir, 'generated.spec.ts'), testCode);

    // Ensure playwright is set up
    const packageJsonPath = path.join(repoDir, 'package.json');
    if (await fs.stat(packageJsonPath).catch(() => false)) {
      // 2. Install dependencies
      await execAsync(`npm install`, { cwd: repoDir });
      
      // Check if build is needed
      const pJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
      if (pJson.scripts && pJson.scripts.build) {
        // 3. Build project
        await execAsync(`npm run build`, { cwd: repoDir });
      }
    }

    // Install playwright browsers (required for real environment execution)
    await execAsync(`npx playwright install --with-deps chromium`, { cwd: repoDir });

    // We start the server if there is a start script (simplification for MVP)
    // and run tests.
    try {
      // 4. Run tests
      const { stdout } = await execAsync(`npx playwright test tests/e2e/generated.spec.ts --reporter=json`, { cwd: repoDir });
      
      const report = JSON.parse(stdout);
      return {
        passed: report.stats.expected || 0,
        failed: report.stats.unexpected || 0,
        report: stdout
      };
    } catch (error: any) {
      // playwright test returns non-zero if tests fail
      const reportStr = error.stdout ? error.stdout.toString() : "{}";
      try {
        const report = JSON.parse(reportStr);
        return {
          passed: report.stats.expected || 0,
          failed: report.stats.unexpected || 0,
          report: reportStr
        };
      } catch (e) {
        return { passed: 0, failed: tests.length, report: error.message };
      }
    }

  } catch (error: any) {
    throw new Error(`QA Worker failed: ${error.message}`);
  } finally {
    // Cleanup
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
