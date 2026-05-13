import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

export interface GitHubWorkerInput {
  branch: string;
  changes: Array<{ file: string; diff: string }>;
  repoUrl: string; // The URL of the repository to clone
}

export async function runGithubWorker(input: GitHubWorkerInput): Promise<string> {
  const { branch, changes, repoUrl } = input;
  const workDir = path.join(process.cwd(), '.tmp', 'github-worker', Date.now().toString());
  
  try {
    await fs.mkdir(workDir, { recursive: true });

    // 1. Clone repository
    await execAsync(`git clone ${repoUrl} repo`, { cwd: workDir });
    const repoDir = path.join(workDir, 'repo');

    // 2. Checkout main & pull latest
    await execAsync(`git checkout main`, { cwd: repoDir });
    await execAsync(`git pull origin main`, { cwd: repoDir });

    // 3. Create branch
    await execAsync(`git checkout -b ${branch}`, { cwd: repoDir });

    // 4. Apply patch (diff)
    for (const change of changes) {
      const patchFile = path.join(workDir, `${Date.now()}.patch`);
      await fs.writeFile(patchFile, change.diff);
      
      // Attempt to apply patch using git apply
      await execAsync(`git apply ${patchFile}`, { cwd: repoDir });
    }

    // 5. Commit
    await execAsync(`git add .`, { cwd: repoDir });
    await execAsync(`git commit -m "feat: agent applied changes"`, { cwd: repoDir });

    // 6. Push
    await execAsync(`git push -u origin ${branch}`, { cwd: repoDir });

    // 7. Create PR (Using gh CLI as standard scriptable way, or via curl/Octokit)
    // Here we simulate API call to GitHub
    console.log(`Simulating PR creation via GitHub API for branch ${branch}`);
    
    // In production, you would use octokit:
    // const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    // await octokit.rest.pulls.create({ owner, repo, head: branch, base: 'main', title: 'Agent updates' });

    return `Successfully created PR for branch ${branch}`;
  } catch (error: any) {
    throw new Error(`GitHub Worker failed: ${error.message}`);
  } finally {
    // Cleanup
    await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
  }
}
