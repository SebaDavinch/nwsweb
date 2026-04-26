#!/usr/bin/env node
// Usage: VAMSYS_CLIENT_ID=... VAMSYS_CLIENT_SECRET=... node scripts/generate-vamsys-mapping.js [id,id,...]
// Outputs JSON suitable for `VAMSYS_MANUAL_MAPPINGS` (map of id -> {id, username, name, email})

const TOKEN_URL = 'https://vamsys.io/oauth/token';
const API_BASE = 'https://vamsys.io/api/v3/operations';

const CLIENT_ID = process.env.VAMSYS_CLIENT_ID;
const CLIENT_SECRET = process.env.VAMSYS_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing VAMSYS_CLIENT_ID or VAMSYS_CLIENT_SECRET in environment');
  process.exit(2);
}

const wantedArg = process.argv[2] || '';
const wantedIds = wantedArg.split(',').map(s => s.trim()).filter(Boolean).map(x=>String(x));

async function getToken() {
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: CLIENT_ID, client_secret: CLIENT_SECRET });
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) throw new Error(`token fetch failed ${res.status}`);
  const data = await res.json();
  return String(data.access_token || '');
}

async function fetchPilots(token) {
  const res = await fetch(`${API_BASE}/pilots?page[size]=300`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`pilots fetch failed ${res.status}`);
  const data = await res.json();
  return Array.isArray(data?.data) ? data.data : [];
}

(async () => {
  try {
    const token = await getToken();
    const pilots = await fetchPilots(token);
    const mapping = {};
    for (const p of pilots) {
      const id = String(p?.id || p?.attributes?.id || '');
      if (!id) continue;
      if (wantedIds.length && !wantedIds.includes(id)) continue;
      const username = String(p?.username || p?.attributes?.username || p?.attributes?.callsign || '') || '';
      const name = String(p?.name || p?.attributes?.name || '') || '';
      const email = String(p?.email || p?.attributes?.email || '') || '';
      mapping[id] = { id: Number(id), username, name, email };
    }

    // If user provided wantedIds but some were not found, emit placeholders
    for (const id of wantedIds) {
      if (!mapping[id]) mapping[id] = { id: Number(id), username: '', name: '', email: '' };
    }

    console.log(JSON.stringify(mapping, null, 2));
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
})();
