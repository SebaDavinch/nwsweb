const BASE_URL = String(process.env.ROUTE_SMOKE_BASE_URL || "http://localhost:8787").replace(/\/$/, "");
const SESSION_COOKIE_NAME = "nws_vamsys_session";
const KEEP_ROUTE = parseBoolean(process.env.ROUTE_SMOKE_KEEP_ROUTE, false);

function parseBoolean(value, fallback = false) {
  if (value == null || value === "") {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "n", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function buildUrl(path) {
  return new URL(path, `${BASE_URL}/`).toString();
}

async function readResponsePayload(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function apiRequest(path, { method = "GET", body, headers = {}, cookie = "", expectedStatus } = {}) {
  const nextHeaders = { ...headers };
  if (cookie) {
    nextHeaders.Cookie = cookie;
  }
  if (body !== undefined) {
    nextHeaders["Content-Type"] = "application/json";
  }

  const response = await fetch(buildUrl(path), {
    method,
    headers: nextHeaders,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const payload = await readResponsePayload(response);
  if (expectedStatus != null && response.status !== expectedStatus) {
    throw new Error(`Expected ${expectedStatus} for ${method} ${path}, got ${response.status}: ${formatPayload(payload)}`);
  }

  if (expectedStatus == null && !response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${formatPayload(payload)}`);
  }

  return { status: response.status, payload };
}

function formatPayload(payload) {
  if (payload == null) {
    return "<empty>";
  }
  if (typeof payload === "string") {
    return payload;
  }
  try {
    return JSON.stringify(payload);
  } catch {
    return String(payload);
  }
}

function getAirportCode(airport) {
  return String(airport?.icao || airport?.iata || airport?.code || airport?.id || "").trim().toUpperCase();
}

function pickAirport(airports, preferredCode, excludeId = null) {
  const items = Array.isArray(airports) ? airports : [];
  const preferred = String(preferredCode || "").trim().toUpperCase();

  if (preferred) {
    const matched = items.find((airport) => {
      const code = getAirportCode(airport);
      return code === preferred || String(airport?.id || "") === preferred;
    });
    if (!matched) {
      throw new Error(`Airport ${preferred} was not found in /api/admin/airports`);
    }
    return matched;
  }

  const fallback = items.find((airport) => String(airport?.id || "") !== String(excludeId || "") && getAirportCode(airport));
  if (!fallback) {
    throw new Error("Could not select a valid airport from /api/admin/airports");
  }
  return fallback;
}

function pickFleet(fleets, preferredFleetId) {
  const items = Array.isArray(fleets) ? fleets : [];
  const preferred = String(preferredFleetId || "").trim().toUpperCase();

  if (preferred) {
    const matched = items.find((fleet) => {
      return [fleet?.id, fleet?.code, fleet?.name]
        .map((value) => String(value || "").trim().toUpperCase())
        .includes(preferred);
    });
    if (!matched) {
      throw new Error(`Fleet ${preferred} was not found in /api/admin/fleet/catalog`);
    }
    return matched;
  }

  const fallback = items.find((fleet) => String(fleet?.id || "").trim());
  if (!fallback) {
    throw new Error("Could not select a valid fleet from /api/admin/fleet/catalog");
  }
  return fallback;
}

function sanitizeFlightPrefix(value) {
  const normalized = String(value || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return (normalized || "NWS").slice(0, 3) || "NWS";
}

function splitFlightPattern(value, defaultPrefix = "NWS", defaultDigitsLength = 3) {
  const normalized = String(value || "").trim().toUpperCase();
  const matched = normalized.match(/^([A-Z]+)(\d+)$/);
  const prefix = sanitizeFlightPrefix(matched?.[1] || defaultPrefix);
  const digitsLength = Math.max(
    1,
    Math.min(Number(matched?.[2]?.length || defaultDigitsLength) || defaultDigitsLength, 6 - prefix.length)
  );

  return { prefix, digitsLength };
}

function buildUniqueFlightIdentity(routes, templateFlightNumber, templateCallsign) {
  const normalizedFlight = String(templateFlightNumber || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const normalizedCallsign = String(templateCallsign || "").trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  const flightMatch = normalizedFlight.match(/(\d+)$/);
  const callsignMatch = normalizedCallsign.match(/(\d+)$/);
  const usedFlights = new Set(
    (Array.isArray(routes) ? routes : [])
      .map((route) => String(route?.flightNumber || "").trim().toUpperCase())
      .filter(Boolean)
  );

  if (flightMatch && callsignMatch) {
    const mutableDigits = Math.max(1, Math.min(2, flightMatch[1].length, callsignMatch[1].length));
    const flightHead = normalizedFlight.slice(0, -mutableDigits);
    const callsignHead = normalizedCallsign.slice(0, -mutableDigits);
    const max = 10 ** mutableDigits - 1;

    for (let number = 0; number <= max; number += 1) {
      const suffix = String(number).padStart(mutableDigits, "0");
      const flightNumber = `${flightHead}${suffix}`;
      if (usedFlights.has(flightNumber)) {
        continue;
      }
      const callsign = `${callsignHead}${suffix}`;
      return { flightNumber, callsign };
    }
  }

  const flightParts = splitFlightPattern(templateFlightNumber, "NWS", 3);
  const callsignParts = splitFlightPattern(templateCallsign, flightParts.prefix, flightParts.digitsLength);
  const digitsLength = Math.max(1, Math.min(flightParts.digitsLength, 6 - flightParts.prefix.length, 7 - callsignParts.prefix.length));
  const max = 10 ** digitsLength - 1;
  const min = Math.max(1, 9 * 10 ** Math.max(0, digitsLength - 1));

  for (let number = min; number <= max; number += 1) {
    const suffix = String(number).padStart(digitsLength, "0");
    const flightNumber = `${flightParts.prefix}${suffix}`;
    if (usedFlights.has(flightNumber)) {
      continue;
    }
    const callsign = `${callsignParts.prefix}${suffix}`;
    return { flightNumber, callsign };
  }

  throw new Error(`Could not find a free smoke-check identity for ${normalizedFlight || templateFlightNumber}`);
}

function pickTemplateRoute(routes, preferredRouteId, preferredFleetId) {
  const items = Array.isArray(routes) ? routes : [];
  const preferredId = String(preferredRouteId || "").trim();
  const preferredFleet = String(preferredFleetId || "").trim();

  if (preferredId) {
    const matched = items.find((route) => String(route?.id || "") === preferredId);
    if (!matched) {
      throw new Error(`Template route ${preferredId} was not found in /api/admin/routes`);
    }
    return matched;
  }

  if (preferredFleet) {
    const matched = items.find((route) => Array.isArray(route?.fleetIds) && route.fleetIds.map(String).includes(preferredFleet));
    if (matched) {
      return matched;
    }
  }

  const fallback = items.find(
    (route) => route?.flightNumber && route?.fromCode && route?.toCode && Array.isArray(route?.fleetIds) && route.fleetIds.length > 0
  );
  if (!fallback) {
    throw new Error("Could not find a valid template route in /api/admin/routes");
  }
  return fallback;
}

async function waitFor(predicate, { attempts = 5, delayMs = 600, label = "condition" } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const result = await predicate();
    if (result) {
      return result;
    }
    if (attempt < attempts) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new Error(`Timed out waiting for ${label}`);
}

async function waitForRouteDetail(routeId, cookie, label) {
  return waitFor(
    async () => {
      try {
        const response = await apiRequest(`/api/admin/routes/${routeId}/detail`, { cookie });
        return response.payload?.route || null;
      } catch (error) {
        const message = String(error?.message || error);
        if (message.includes(" 404:") || message.includes("Route not found")) {
          return null;
        }
        throw error;
      }
    },
    { attempts: 10, delayMs: 1000, label }
  );
}

async function seedDevAdminSession() {
  const honoraryRankId = Number(process.env.ROUTE_SMOKE_ADMIN_HONORARY_RANK_ID || 5) || 5;
  const username = String(process.env.ROUTE_SMOKE_ADMIN_USERNAME || "NWSADM").trim().toUpperCase() || "NWSADM";
  const response = await fetch(buildUrl("/__dev/seed-vamsys-session"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user: {
        id: String(process.env.ROUTE_SMOKE_ADMIN_ID || "99999"),
        username,
        name: "Route Smoke Admin",
        email: "route-smoke@example.com",
        rank: "Staff",
        honorary_rank_id: honoraryRankId,
        honorary_rank: { id: honoraryRankId },
        isStaff: true,
        joinedAt: new Date().toISOString(),
      },
      accessToken: "dev-route-smoke-token",
    }),
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw new Error(
      `Could not seed a dev vAMSYS session. Start the API with ENABLE_DEV_SESSIONS=true. Response: ${formatPayload(payload)}`
    );
  }

  const sessionId = String(payload?.sessionId || "").trim();
  assert(sessionId, "Dev seed succeeded but no sessionId was returned");
  return `${SESSION_COOKIE_NAME}=${sessionId}`;
}

async function main() {
  const startedAt = Date.now();
  let cookie = String(process.env.ROUTE_SMOKE_COOKIE || "").trim();
  let routeId = 0;

  try {
    console.log(`[smoke-admin-routes] base url: ${BASE_URL}`);

    if (!cookie) {
      console.log("[smoke-admin-routes] no ROUTE_SMOKE_COOKIE provided, attempting dev admin session seed");
      cookie = await seedDevAdminSession();
    }

    const auth = await apiRequest("/api/auth/me", { cookie });
    assert(auth.payload?.authenticated, "The seeded/provided session is not authenticated");
    assert(auth.payload?.isAdmin, `Admin session is required, got: ${formatPayload(auth.payload)}`);
    console.log(`[smoke-admin-routes] authenticated as ${auth.payload?.user?.username || auth.payload?.user?.name || "admin"}`);

    const [airportsResponse, fleetResponse, hubsResponse, routesResponse] = await Promise.all([
      apiRequest("/api/admin/airports", { cookie }),
      apiRequest("/api/admin/fleet/catalog", { cookie }),
      apiRequest("/api/admin/hubs", { cookie }),
      apiRequest("/api/admin/routes", { cookie }),
    ]);

    const airports = Array.isArray(airportsResponse.payload?.airports) ? airportsResponse.payload.airports : [];
    const fleets = Array.isArray(fleetResponse.payload?.fleets) ? fleetResponse.payload.fleets : [];
    const hubs = Array.isArray(hubsResponse.payload?.hubs) ? hubsResponse.payload.hubs : [];
    const routes = Array.isArray(routesResponse.payload?.routes) ? routesResponse.payload.routes : [];

    const templateRoute = pickTemplateRoute(
      routes,
      process.env.ROUTE_SMOKE_TEMPLATE_ROUTE_ID,
      process.env.ROUTE_SMOKE_FLEET_ID
    );
    const templateDetailResponse = await apiRequest(`/api/admin/routes/${templateRoute.id}/detail`, { cookie });
    const templateDetail = templateDetailResponse.payload?.route || {};

    const departure = pickAirport(airports, process.env.ROUTE_SMOKE_DEPARTURE || templateDetail?.departureCode || templateRoute?.fromCode);
    const arrival = pickAirport(
      airports,
      process.env.ROUTE_SMOKE_ARRIVAL || templateDetail?.arrivalCode || templateRoute?.toCode,
      departure?.id
    );
    assert(String(departure?.id || "") !== String(arrival?.id || ""), "Departure and arrival must be different airports");

    const fleet = pickFleet(fleets, process.env.ROUTE_SMOKE_FLEET_ID || String(templateRoute?.fleetIds?.[0] || ""));
    const selectedHubId = String(process.env.ROUTE_SMOKE_HUB_ID || "").trim() || String(hubs[0]?.id || "").trim();

    const identity = buildUniqueFlightIdentity(routes, templateRoute?.flightNumber || templateDetail?.flightNumber, templateDetail?.callsign || templateRoute?.flightNumber);
    const flightNumber = identity.flightNumber;
    const callsign = identity.callsign;
    const updatedCallsign = callsign.length >= 7 ? `${callsign.slice(0, 6)}X` : `${callsign}X`;
    const startDate = formatDateOnly(new Date());
    const endDate = formatDateOnly(new Date(Date.now() + 1000 * 60 * 60 * 24 * 14));

    console.log(
      `[smoke-admin-routes] using template route ${templateRoute?.id} and ${getAirportCode(departure)} -> ${getAirportCode(arrival)} with fleet ${fleet?.id}${fleet?.code ? ` (${fleet.code})` : ""}`
    );
    console.log(`[smoke-admin-routes] template identity ${templateRoute?.flightNumber || templateDetail?.flightNumber} / ${templateDetail?.callsign || templateRoute?.flightNumber} -> ${flightNumber} / ${callsign}`);

    const createPayload = {
      flightNumber,
      callsign,
      type: "scheduled",
      departureCode: getAirportCode(departure),
      arrivalCode: getAirportCode(arrival),
      departureTimeUtc: "08:00",
      arrivalTimeUtc: "10:15",
      startDate,
      endDate,
      duration: "02:15:00",
      distanceNm: "1234",
      routeText: `DCT ${getAirportCode(departure)} DCT ${getAirportCode(arrival)}`,
      remarks: "Route smoke test create",
      routeNotes: "Route smoke test internal create",
      flightLevel: "36000",
      costIndex: "42",
      liveTags: "smoke-create, admin-routes",
      hidden: false,
      fleetIds: [String(fleet.id)],
      serviceDays: ["mon", "wed", "fri"],
    };

    const createResponse = await apiRequest("/api/admin/routes", { method: "POST", body: createPayload, cookie });
    routeId = Number(
      createResponse.payload?.route?.id ||
      createResponse.payload?.route?.data?.id ||
      createResponse.payload?.id ||
      createResponse.payload?.data?.id ||
      0
    ) || 0;
    assert(routeId > 0, `Route create did not return a route id: ${formatPayload(createResponse.payload)}`);
    console.log(`[smoke-admin-routes] created route ${routeId} (${flightNumber})`);

    const createdRoute = await waitForRouteDetail(routeId, cookie, "created route detail");
    const createdLiveDetail = createdRoute?.detail || {};
    assert(String(createdLiveDetail?.flightNumber || createdRoute?.flightNumber || "").toUpperCase() === flightNumber, "Created detail returned an unexpected flight number");
    assert(createdLiveDetail?.liveHidden === false, "Created route did not persist live hidden=false");
    console.log("[smoke-admin-routes] live detail verified after create");

    await apiRequest(`/api/admin/routes/${routeId}/meta`, {
      method: "PUT",
      cookie,
      body: {
        hubId: selectedHubId,
        status: "active",
        priority: "normal",
        section: "default",
        notes: "Route smoke test overlay",
        remarks: "Route smoke test public overlay",
        internalRemarks: "Route smoke test internal overlay",
        tags: "smoke-overlay, qa",
        hidden: false,
      },
    });
    console.log("[smoke-admin-routes] overlay meta saved");

    try {
      await waitFor(
        async () => {
          const catalog = await apiRequest("/api/admin/routes", { cookie });
          const route = (Array.isArray(catalog.payload?.routes) ? catalog.payload.routes : []).find((item) => Number(item?.id || 0) === routeId);
          if (!route) {
            return null;
          }
          const overlayTags = Array.isArray(route?.meta?.tags) ? route.meta.tags : [];
          return overlayTags.includes("smoke-overlay") ? route : null;
        },
        { label: "overlay meta propagation" }
      );
      console.log("[smoke-admin-routes] overlay meta verified in route catalog");
    } catch (error) {
      console.warn(`[smoke-admin-routes] overlay meta propagation not observed in catalog: ${String(error?.message || error)}`);
    }

    const updatePayload = {
      callsign: updatedCallsign,
      departureTimeUtc: "08:30",
      arrivalTimeUtc: "10:55",
      duration: "02:25:00",
      distanceNm: "1288",
      routeText: `DCT ${getAirportCode(departure)} PNT A1 DCT ${getAirportCode(arrival)}`,
      remarks: "Route smoke test update",
      routeNotes: "Route smoke test internal update",
      costIndex: "55",
      liveTags: "smoke-update, admin-routes",
      hidden: true,
      serviceDays: ["tue", "thu"],
      fleetIds: [String(fleet.id)],
    };

    await apiRequest(`/api/admin/routes/${routeId}`, { method: "PUT", body: updatePayload, cookie });
    console.log("[smoke-admin-routes] live route updated");

    const updatedRoute = await waitForRouteDetail(routeId, cookie, "updated route detail");
    const updatedLiveDetail = updatedRoute?.detail || {};
    assert(String(updatedLiveDetail?.callsign || updatedRoute?.callsign || "").toUpperCase() === updatedCallsign, "Updated detail returned an unexpected callsign");
    assert(updatedLiveDetail?.liveHidden === true, "Updated route did not persist live hidden=true");
    assert(Array.isArray(updatedLiveDetail?.liveTags) && updatedLiveDetail.liveTags.includes("smoke-update"), "Updated route did not persist live tags");
    console.log("[smoke-admin-routes] live detail verified after update");

    if (KEEP_ROUTE) {
      console.log(`[smoke-admin-routes] keeping route ${routeId} because ROUTE_SMOKE_KEEP_ROUTE=true`);
    } else {
      await apiRequest(`/api/admin/routes/${routeId}`, { method: "DELETE", cookie });
      console.log("[smoke-admin-routes] route deleted");
      const deletedRouteId = routeId;
      routeId = 0;

      await waitFor(
        async () => {
          const response = await fetch(buildUrl(`/api/admin/routes/${deletedRouteId}/detail`), {
            headers: cookie ? { Cookie: cookie } : undefined,
          });
          const payload = await readResponsePayload(response);
          if (response.status === 404) {
            return true;
          }
          if (response.status === 502 && String(payload?.error || payload || "").includes("Resource not found")) {
            return true;
          }
          if (response.ok) {
            return null;
          }
          throw new Error(`Unexpected delete verification response ${response.status}: ${formatPayload(payload)}`);
        },
        { label: "route deletion" }
      );
      console.log("[smoke-admin-routes] delete verified");
    }

    const elapsedMs = Date.now() - startedAt;
    console.log(`[smoke-admin-routes] success in ${elapsedMs} ms`);
  } finally {
    if (routeId > 0 && !KEEP_ROUTE) {
      try {
        await apiRequest(`/api/admin/routes/${routeId}`, { method: "DELETE", cookie });
        console.log(`[smoke-admin-routes] cleanup deleted route ${routeId} after failure`);
      } catch (cleanupError) {
        console.warn(`[smoke-admin-routes] cleanup failed for route ${routeId}: ${String(cleanupError?.message || cleanupError)}`);
      }
    }
  }
}

main().catch(async (error) => {
  console.error(`[smoke-admin-routes] failed: ${String(error?.message || error)}`);
  process.exitCode = 1;
});