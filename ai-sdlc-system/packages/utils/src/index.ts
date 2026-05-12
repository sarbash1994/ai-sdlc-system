import { customAlphabet } from "nanoid";

const idAlphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const makeId = customAlphabet(idAlphabet, 12);

export function createTaskId(): string {
  return `task_${makeId()}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function slugifyBranchPart(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "task";
}

export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
