// This file previously set up a BullMQ pipeline queue backed by Redis.
// Job processing is now handled entirely by the local file-based queue in
// apps/worker/src/index.ts via claimNextLocalJob() / storage/jobs.json.
// Keeping this file to preserve the import without side effects.

export {};
