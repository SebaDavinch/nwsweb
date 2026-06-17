import fetch from "node-fetch";

const BACKEND_URL = (process.env.BACKEND_URL || "").replace(/\/$/, "");
const API_KEY = process.env.CHATBOT_API_KEY || "";

const headers = () => ({ "x-bot-api-key": API_KEY, "Content-Type": "application/json" });

export async function getActiveChannels() {
  const res = await fetch(`${BACKEND_URL}/api/bot/channels`, { headers: headers() });
  if (!res.ok) throw new Error(`getActiveChannels failed: ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.channels) ? data.channels : [];
}

export async function getPilotByCallsign(callsign) {
  const res = await fetch(`${BACKEND_URL}/api/bot/pilot-data?callsign=${encodeURIComponent(callsign)}`, { headers: headers() });
  if (!res.ok) return null;
  return res.json();
}

export async function getOnlineFlights() {
  const res = await fetch(`${BACKEND_URL}/api/public/flights/live`, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.flights) ? data.flights : [];
}

export async function getActiveNotams() {
  const res = await fetch(`${BACKEND_URL}/api/public/notams`, { headers: headers() });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data.notams) ? data.notams : [];
}

export async function getMetar(icao) {
  const res = await fetch(`${BACKEND_URL}/api/public/metar?icao=${encodeURIComponent(icao)}`, { headers: headers() });
  if (!res.ok) return null;
  return res.json();
}
