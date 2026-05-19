import request from "supertest";
import express from "express";
import { JsonFileTaskStore } from "@ai-sdlc/orchestrator";

// Mock the modules that are used inside the index.ts
jest.mock("@ai-sdlc/orchestrator", () => {
  return {
    JsonFileTaskStore: jest.fn().mockImplementation(() => {
      return {
        listTasks: jest.fn(),
        createTask: jest.fn()
      };
    }),
    createPipelineQueue: jest.fn(() => ({ add: jest.fn() }))
  };
});

jest.mock("@ai-sdlc/logger", () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

import { loadConfig } from "@ai-sdlc/config";
import { createIdeaInputSchema } from "@ai-sdlc/types";

jest.mock("@ai-sdlc/config", () => ({ loadConfig: jest.fn() }));
jest.mock("@ai-sdlc/types", () => ({ createIdeaInputSchema: { parse: jest.fn() } }));

// We will import the app after mocking dependencies to avoid side effects during import
let app: express.Express;
let taskStoreMock: any;

beforeAll(async () => {
  // Clear require cache for index.ts to reload it fresh with mocks
  jest.resetModules();

  // Setup mock implementations
  const { JsonFileTaskStore } = await import("@ai-sdlc/orchestrator");

  taskStoreMock = new JsonFileTaskStore();
  // Mock listTasks to return some data
  taskStoreMock.listTasks.mockResolvedValue([
    { id: "1", status: "running" },
    { id: "2", status: "completed" },
    { id: "3", status: "running" }
  ]);

  // Override app import to reflect mocks
  jest.doMock("express", () => {
    const actualExpress = jest.requireActual("express");
    const mockedExpress = () => {
      const exp = actualExpress();
      return exp;
    };
    Object.assign(mockedExpress, actualExpress);
    return { default: mockedExpress };
  });

  // Import the actual app after mocks
  const index = await import("./index");
  app = index.app || actualExpress(); // fallback, should have app exported or default
});

describe("GET /health/detailed", () => {
  it("should return uptime, runningAgentsCount, and dbStatus", async () => {
    const response = await request(app).get("/health/detailed");

    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty("uptime");
    expect(response.body).toHaveProperty("runningAgentsCount");
    expect(response.body).toHaveProperty("dbStatus");

    expect(typeof response.body.uptime).toBe("string");
    expect(typeof response.body.runningAgentsCount).toBe("number");
    // There should be exactly 2 running tasks in mock
    expect(response.body.runningAgentsCount).toBe(2);
    expect(typeof response.body.dbStatus).toBe("string");
  });

  it("should handle database connection failure", async () => {
    // Override listTasks to throw error once
    taskStoreMock.listTasks.mockRejectedValueOnce(new Error("DB connection failed"));

    const response = await request(app).get("/health/detailed");

    expect(response.status).toBe(200);
    expect(response.body.dbStatus).toContain("DB connection failed");
  });
});
