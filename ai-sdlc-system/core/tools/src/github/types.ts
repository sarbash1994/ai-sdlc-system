import type { BackendDevOutput } from "@ai-sdlc/types";

export type GitHubWorkerConfig = {
  token: string;
  owner: string;
  repo: string;
  defaultBranch: string;
};

export type PullRequestResult = {
  url: string;
  branch: string;
  commitSha: string;
};

export type CreatePullRequestInput = {
  taskId: string;
  idea: string;
  devOutput: BackendDevOutput;
};
