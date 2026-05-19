import request from 'supertest';
import express from 'express';
import { jest } from '@jest/globals';

// We import the real app from index.ts for testing endpoints
let app;

beforeAll(async () => {
  // Dynamically import the app from the API source to ensure setup
  const mod = await import('./index');
  app = mod.app;
});

describe('GET /health/detailed', () => {
  it('should return detailed health info with expected properties', async () => {
    const res = await request(app).get('/health/detailed');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ok', true);
    expect(res.body).toHaveProperty('uptimeSeconds');
    expect(res.body).toHaveProperty('memoryUsage');
    expect(res.body).toHaveProperty('serverTime');
    expect(res.body).toHaveProperty('apiVersion', '1.0.0');
  });
});
