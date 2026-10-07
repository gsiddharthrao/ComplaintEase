import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 }, // ramp-up to 20 virtual users
    { duration: '1m', target: 20 },  // sustain load
    { duration: '15s', target: 0 },  // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.01'],    // less than 1% failure
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000/api/v1';
const AUTH_TOKEN = __ENV.AUTH_TOKEN || '';

export default function () {
  const params = {
    headers: {
      'Content-Type': 'application/json',
      ...(AUTH_TOKEN ? { Authorization: `Bearer ${AUTH_TOKEN}` } : {}),
    },
  };

  // 1. Benchmark GET /complaints with keyset pagination & filters
  const listRes = http.get(`${BASE_URL}/complaints?limit=20`, params);
  check(listRes, {
    'list status is 200': (r) => r.status === 200,
    'list returns data array': (r) => JSON.parse(r.body).data !== undefined,
  });

  sleep(1);

  // 2. Benchmark Health endpoint
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health status is 200 or 503': (r) => r.status === 200 || r.status === 503,
  });

  sleep(1);
}

