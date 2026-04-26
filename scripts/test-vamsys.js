// Simple test script to fetch a vAMSYS token and query pilot + general statistics
// Usage: set VAMSYS_CLIENT_ID and VAMSYS_CLIENT_SECRET in env, then `node scripts/test-vamsys.js`

const TOKEN_URL = 'https://vamsys.io/oauth/token';
const API_BASE = 'https://vamsys.io/api/v3/operations';

const clientId = process.env.VAMSYS_CLIENT_ID;
const clientSecret = process.env.VAMSYS_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('Missing VAMSYS_CLIENT_ID or VAMSYS_CLIENT_SECRET in environment');
  process.exit(2);
}

const fetchToken = async () => {
  const body = new URLSearchParams({ grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret });
  const res = await fetch(TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text, status: res.status }; }
};

const callApi = async (path, token) => {
  const res = await fetch(`${API_BASE}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  const text = await res.text();
  try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; } catch { return { ok: res.ok, status: res.status, data: text }; }
};

(async () => {
  try {
    console.log('Fetching token...');
    const tokenResp = await fetchToken();
    if (!tokenResp || !tokenResp.access_token) {
      console.error('Token response:', tokenResp);
      process.exit(1);
    }
    const token = tokenResp.access_token;
    console.log('Token acquired, expires_in=', tokenResp.expires_in || 'unknown');

    console.log('\nQuerying pilot 20393...');
    const pilot = await callApi('/pilots/20393', token);
    console.log(JSON.stringify({ pilot_ok: pilot.ok, pilot_status: pilot.status, pilot_data_snippet: pilot.data && (pilot.data.data || pilot.data).statistics ? { hasStatistics: true } : { hasStatistics: Boolean(pilot.data) } }, null, 2));

    console.log('\nQuerying statistics/general...');
    const stats = await callApi('/statistics/general', token);
    console.log(JSON.stringify({ stats_ok: stats.ok, stats_status: stats.status, stats_keys: stats.data && typeof stats.data === 'object' ? Object.keys(stats.data).slice(0,10) : stats.data }, null, 2));
  } catch (err) {
    console.error('Error:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
})();
