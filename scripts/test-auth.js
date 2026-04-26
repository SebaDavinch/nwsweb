#!/usr/bin/env node
import http from 'node:http';
import { URL } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const HOST = process.env.VAMSYS_HOST || 'http://127.0.0.1:8787';

const doRequest = (method, urlPath, { headers = {}, body = null } = {}) => {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, HOST);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + (url.search || ''),
      headers: headers || {},
    };

    const req = http.request(opts, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        resolve({ statusCode: res.statusCode, headers: res.headers, body: text });
      });
    });

    req.on('error', (err) => reject(err));

    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
};

const assert = (cond, msg) => {
  if (!cond) {
    console.error('ASSERT FAILED:', msg);
    process.exitCode = 2;
    throw new Error(msg);
  }
};

const main = async () => {
  console.log('Starting local auth tests against', HOST);

  // Seed session
  console.log('Seeding dev session for pilot 20393...');
  const seedBody = { id: '20393', username: 'NWS0001', name: 'Grigorii Adamov NWS0001' };
  const seed = await doRequest('POST', '/__dev/seed-vamsys-session', {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(seedBody),
  });
  assert(seed.statusCode === 200, `seed returned ${seed.statusCode} ${seed.body}`);
  const seedJson = JSON.parse(seed.body);
  const sessionId = seedJson.sessionId;
  assert(sessionId, 'no sessionId from seed');
  console.log('Seeded sessionId:', sessionId);

  // cookie may be returned in Set-Cookie header; use our sessionId
  const cookie = `nws_vamsys_session=${sessionId}`;

  // Call roster-me
  console.log('Calling /api/auth/vamsys/roster-me...');
  const roster = await doRequest('GET', '/api/auth/vamsys/roster-me', { headers: { Cookie: cookie } });
  console.log('roster status', roster.statusCode);
  assert(roster.statusCode === 200, `roster-me returned ${roster.statusCode} ${roster.body}`);
  const rosterJson = JSON.parse(roster.body);
  assert(rosterJson.ok === true, 'roster-me ok !== true');
  const user = rosterJson.user || {};
  assert(user.id === '20393', `unexpected id ${user.id}`);
  assert(user.username === 'NWS0001', `unexpected username ${user.username}`);
  assert(user.name && user.name.includes('Grigorii'), `unexpected name ${user.name}`);
  console.log('Roster-me returned expected user:', user.username, user.name);

  // Call /api/auth/vamsys/me
  console.log('Calling /api/auth/vamsys/me...');
  const me = await doRequest('GET', '/api/auth/vamsys/me', { headers: { Cookie: cookie } });
  assert(me.statusCode === 200, `/api/auth/vamsys/me returned ${me.statusCode}`);
  const meJson = JSON.parse(me.body);
  assert(meJson.authenticated === true, '/api/auth/vamsys/me not authenticated');
  assert(meJson.user && typeof meJson.user === 'object', '/api/auth/vamsys/me missing user');
  // Prefer the session-mapped id (20393). If the server resolved a different Operations id,
  // accept that only when a manual mapping still exists in the auth-store for 20393.
  const resolvedId = String(meJson.user.id || '');
  if (resolvedId === '20393') {
    console.log('/api/auth/vamsys/me returned expected id 20393');
  } else {
    console.warn('/api/auth/vamsys/me returned different id', resolvedId);
    // ensure manual mapping exists for 20393 as a safety net
    const authFile = process.env.AUTH_STORAGE_FILE || path.resolve(process.cwd(), 'data', 'auth-store.json');
    if (fs.existsSync(authFile)) {
      const raw = fs.readFileSync(authFile, 'utf8');
      const parsed = JSON.parse(raw);
      const manual = parsed.vamsysLinks && parsed.vamsysLinks['20393'];
      assert(manual, `me resolved id ${resolvedId} and no manual vamsysLinks[20393] found`);
      console.log('Manual mapping present for 20393 — test accepts resolved id', resolvedId);
    } else {
      assert(false, `me resolved id ${resolvedId} and auth-store.json not found to verify manual mapping`);
    }
  }

  // Inspect local auth-store.json if present
  const authFile = process.env.AUTH_STORAGE_FILE || path.resolve(process.cwd(), 'data', 'auth-store.json');
  if (fs.existsSync(authFile)) {
    console.log('Checking', authFile);
    const raw = fs.readFileSync(authFile, 'utf8');
    const parsed = JSON.parse(raw);
    const link = parsed.vamsysLinks && parsed.vamsysLinks['20393'];
    assert(link, 'no vamsysLinks[20393] in auth-store.json');
    assert(link.name.includes('Grigorii'), 'auth-store name not updated');
    assert(link.username === 'NWS0001', 'auth-store username not updated');
    console.log('auth-store.json vamsysLinks[20393] OK');
  } else {
    console.warn('auth-store.json not found at', authFile);
  }

  console.log('All local auth tests passed.');
};

main().catch((err) => {
  console.error('Test failed:', err && err.message);
  process.exit(process.exitCode || 1);
});
