import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('API Endpoints & Middleware Integration Tests', () => {
  it('GET /api/v1/health returns 200 or 503 and health details', async () => {
    const res = await request(app).get('/api/v1/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('database');
  });

  it('GET /api/v1/complaints returns 401 UNAUTHORIZED when no token is supplied', async () => {
    const res = await request(app).get('/api/v1/complaints');
    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error.code).toBe('UNAUTHORIZED');
    expect(res.body.error).toHaveProperty('requestId');
  });

  it('POST /api/v1/auth/register returns 400 VALIDATION_ERROR for invalid payload', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
  });

  it('GET /api/v1/non-existent-route returns 404 NOT_FOUND with requestId', async () => {
    const res = await request(app).get('/api/v1/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
    expect(res.body.error).toHaveProperty('requestId');
  });
});

