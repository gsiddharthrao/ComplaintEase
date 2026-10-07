import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../app.js';

describe('Role-Based Route Guard Integration Tests', () => {
  it('rejects unauthenticated requests to /api/v1/admin/users with 401', async () => {
    const res = await request(app).get('/api/v1/admin/users');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated requests to /api/v1/admin/departments with 401', async () => {
    const res = await request(app).get('/api/v1/admin/departments');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated requests to /api/v1/admin/audit-logs with 401', async () => {
    const res = await request(app).get('/api/v1/admin/audit-logs');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('rejects unauthenticated assignments with 401', async () => {
    const res = await request(app)
      .post('/api/v1/complaints/11111111-1111-1111-1111-111111111111/assign')
      .send({ assigned_to: '22222222-2222-2222-2222-222222222222' });
    expect(res.status).toBe(401);
  });

  it('rejects unauthenticated complaint creation with 401', async () => {
    const res = await request(app)
      .post('/api/v1/complaints')
      .send({
        title: 'Title that is long enough',
        description: 'Description that is definitely long enough for validation',
        category_id: '11111111-1111-1111-1111-111111111111',
        department_id: '22222222-2222-2222-2222-222222222222',
      });
    expect(res.status).toBe(401);
  });
});
