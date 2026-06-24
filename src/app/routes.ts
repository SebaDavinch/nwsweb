import { createBrowserRouter, Navigate } from "react-router";
import { createElement } from "react";
import { Root } from "./components/root";
import { AppShell } from "./components/desktop/app-shell";
import { HubMode } from "./components/desktop/hub-mode";
import { FlightMode } from "./components/desktop/flight-mode";
import { OfpMode } from "./components/desktop/ofp-mode";
import { StreamRoot } from "./components/stream/stream-root";
import { StreamFlightMap } from "./components/stream/stream-flight-map";
import { Home } from "./components/home";
import { About } from "./components/about";
import { Fleet } from "./components/fleet";
import { FleetAircraftPage } from "./components/fleet-aircraft-page";
import { Routes } from "./components/routes";
import { Join } from "./components/join";
import { LiveFlights } from "./components/live-flights";
import { Login } from "./components/login";
import { Documents } from "./components/documents";
import { PilotDashboard } from "./components/dashboard/pilot-dashboard";
import { PilotBookingView } from "./components/dashboard/pilot-booking-view";
import { PilotDispatch } from "./components/dashboard/pilot-dispatch";
import { ActivitiesPage, NewsPage } from "./components/news-page";
import { SlottedEventDetail } from "./components/slotted-event-detail";
import { TestSlottedEvent } from "./components/test-slotted-event";
import { AdminDashboard } from "./components/admin/admin-dashboard";
import { AdminAcars } from "./components/admin/admin-acars";
import { AdminNews } from "./components/admin/admin-news";
import { AdminActivities } from "./components/admin/admin-activities";
import { AdminPilots } from "./components/admin/admin-pilots";
import { AdminPilotProfile } from "./components/admin/admin-pilot-profile";
import { AdminFleet } from "./components/admin/admin-fleet";
import { AdminSettings } from "./components/admin/admin-settings";
import { AdminLayout } from "./components/admin/admin-layout";
import { AdminDocuments } from "./components/admin/admin-documents";
import { AdminStaff } from "./components/admin/admin-staff";
import { AdminEvents } from "./components/admin/admin-events";
import { TicketsPage } from "./components/tickets";
import {
  AdminBadges,
} from "./components/admin/admin-content-pages";
import { AdminBookingsManagement, AdminRoutesManagement } from "./components/admin/admin-operations-pages";
import { AdminPireps, AdminPirepDetail } from "./components/admin/admin-pireps";
import { AdminAirportsManagement, AdminHubsManagement } from "./components/admin/admin-network-pages";
import { AdminTickets } from "./components/admin/admin-tickets";
import { AdminDiscordBot } from "./components/admin/admin-discord-bot";
import { AdminTelegramBot } from "./components/admin/admin-telegram-bot";
import { AdminAuditLogs } from "./components/admin/admin-audit-logs";
import { AdminAuthLogs } from "./components/admin/admin-auth-logs";
import { StaffTeam } from "./components/staff-team";
import { DownloadPage } from "./components/download-page";
import { GateAssigner } from "./components/gate-assigner";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Home },
      { path: "about", Component: About },
      { path: "activities", Component: ActivitiesPage },
      { path: "activities/slotted/:id", Component: SlottedEventDetail },
      { path: "news", Component: NewsPage },
      { path: "fleet", Component: Fleet },
      { path: "fleet/:fleetId/aircraft/:aircraftId", Component: FleetAircraftPage },
      { path: "routes", Component: Routes },
      { path: "team", Component: StaffTeam },
      { path: "gates", Component: GateAssigner },
      { path: "join", Component: Join },
      { path: "live", Component: LiveFlights },
      { path: "login", Component: Login },
      { path: "documents", Component: Documents },
      { path: "download", Component: DownloadPage },
      { path: "tickets", Component: TicketsPage },
      { path: "testivent", Component: TestSlottedEvent },

      { path: "dashboard", Component: PilotDashboard },
      { path: "dashboard/passport/:countryIso2", Component: PilotDashboard },
      { path: "dashboard/booking/:id", Component: PilotBookingView },
      { path: "dashboard/dispatch", Component: PilotDispatch },
    ],
  },
  {
    path: "/stream",
    Component: StreamRoot,
    children: [
      { path: "map", Component: StreamFlightMap },
    ],
  },
  {
    path: "/admin",
    Component: AdminLayout,
    children: [
      { index: true, Component: AdminDashboard },
      { path: "news", Component: AdminNews },
      { path: "pilots", Component: AdminPilots },
      { path: "pilots/:id", Component: AdminPilotProfile },
      { path: "fleet", Component: AdminFleet },
      { path: "documents", Component: AdminDocuments },
      { path: "resources", Component: AdminDocuments },
      { path: "events", Component: AdminEvents },
      { path: "staff", Component: AdminStaff },
      { path: "badges", Component: AdminBadges },
      { path: "activities", Component: AdminActivities },
      { path: "audit-logs", Component: AdminAuditLogs },
      { path: "auth-logs", Component: AdminAuthLogs },
      { path: "bookings", Component: AdminBookingsManagement },
      { path: "routes", Component: AdminRoutesManagement },
      { path: "pireps", Component: AdminPireps },
      { path: "pireps/:id", Component: AdminPirepDetail },
      { path: "airports", Component: AdminAirportsManagement },
      { path: "hubs", Component: AdminHubsManagement },
      { path: "tickets", Component: AdminTickets },
      { path: "discord-bot", Component: AdminDiscordBot },
      { path: "telegram-bot", Component: AdminTelegramBot },

      { path: "acars", Component: AdminAcars },
      { path: "settings", Component: AdminSettings },
      { path: "*", Component: AdminDashboard },
    ]
  },
  {
    path: "/app",
    Component: AppShell,
    children: [
      { index: true, element: createElement(Navigate, { to: "/app/hub", replace: true }) },
      { path: "hub", Component: HubMode },
      { path: "flight", Component: FlightMode },
      { path: "ofp", Component: OfpMode },
      { path: "dispatch", element: createElement(PilotDispatch, { variant: "app" }) },
    ],
  },
  {
    path: "/stream",
    Component: StreamRoot,
    children: [
      { path: "map", Component: StreamFlightMap },
    ],
  },
]);
