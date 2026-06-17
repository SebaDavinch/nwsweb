import { getPilotByCallsign, getOnlineFlights, getActiveNotams, getMetar } from "../api-client.js";

// Returns a reply string or null if command not recognized
export async function handleCommand(message, senderName) {
  const trimmed = message.trim();
  if (!trimmed.startsWith("!")) return null;

  const [cmd, ...args] = trimmed.slice(1).split(/\s+/);
  const command = cmd.toLowerCase();

  try {
    switch (command) {
      case "metar": {
        const icao = (args[0] || "").toUpperCase();
        if (!icao || icao.length < 3) return `@${senderName} Укажи ICAO: !metar UUEE`;
        const data = await getMetar(icao);
        if (!data?.raw) return `@${senderName} METAR для ${icao} не найден`;
        return `@${senderName} 🌤 ${icao}: ${data.raw}`;
      }

      case "rank": {
        const callsign = (args[0] || "").toUpperCase();
        if (!callsign) return `@${senderName} Укажи каллсайн: !rank NWS001`;
        const data = await getPilotByCallsign(callsign);
        if (!data?.flight) return `@${senderName} Пилот ${callsign} не найден`;
        const f = data.flight;
        return `@${senderName} ✈ ${callsign} | ${f.callsign || "—"} | ${f.departure || "—"} → ${f.arrival || "—"} | Alt: ${f.altitude || 0}ft | GS: ${f.speed || 0}kt`;
      }

      case "flight": {
        const callsign = (args[0] || senderName).toUpperCase();
        const data = await getPilotByCallsign(callsign);
        if (!data?.flight) return `@${senderName} Активный рейс не найден для ${callsign}`;
        const f = data.flight;
        return `@${senderName} ✈ ${f.callsign || callsign} | ${f.departure || "—"} → ${f.arrival || "—"} | ${f.altitude || 0}ft | ${f.speed || 0}kt | ${f.progress || 0}%`;
      }

      case "online": {
        const flights = await getOnlineFlights();
        if (!flights.length) return `@${senderName} Сейчас никто не летит`;
        const list = flights.slice(0, 5).map((f) => `${f.callsign || f.flightNumber} (${f.departure || "?"}→${f.arrival || "?"})`).join(", ");
        const more = flights.length > 5 ? ` +${flights.length - 5} ещё` : "";
        return `@${senderName} 🛫 В воздухе (${flights.length}): ${list}${more}`;
      }

      case "notam": {
        const notams = await getActiveNotams();
        if (!notams.length) return `@${senderName} Активных NOTAMов нет`;
        const urgent = notams.filter((n) => n.type === "critical" || n.priority === "high");
        const display = (urgent.length ? urgent : notams).slice(0, 3);
        return `@${senderName} 📋 NOTAMы: ${display.map((n) => n.title).join(" | ")}`;
      }

      case "help":
      case "commands": {
        return `@${senderName} Команды NWSBot: !metar <ICAO> | !flight <callsign> | !online | !notam | !rank <callsign>`;
      }

      default:
        return null;
    }
  } catch (err) {
    console.error(`[commands] Error handling !${command}:`, err?.message);
    return null;
  }
}
