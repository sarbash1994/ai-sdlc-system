import { z } from 'zod';

export const BaOutputSchema = z.object({
  business_requirements: z.array(z.string()),
  user_stories: z.array(z.object({
    role: z.string(),
    goal: z.string(),
    benefit: z.string()
  })),
  edge_cases: z.array(z.string()),
  assumptions: z.array(z.string())
});

export const PmOutputSchema = z.object({
  tasks: z.array(z.object({
    id: z.string(),
    type: z.enum(["frontend", "backend", "mobile", "devops"]),
    title: z.string(),
    description: z.string(),
    acceptance_criteria: z.array(z.string()),
    dependencies: z.array(z.string())
  }))
});

export const DevOutputSchema = z.object({
  branch: z.string(),
  changes: z.array(z.object({
    file: z.string(),
    diff: z.string()
  })),
  notes: z.string(),
  commands: z.array(z.string()).optional()
});

export const QaAutoOutputSchema = z.object({
  tests: z.array(z.object({
    name: z.string(),
    steps: z.array(z.string()),
    expected: z.array(z.string())
  })),
  edge_cases: z.array(z.string())
});

export const QaManualOutputSchema = z.object({
  checklist: z.array(z.string()),
  exploratory_tests: z.array(z.string()),
  ux_issues_to_check: z.array(z.string())
});
