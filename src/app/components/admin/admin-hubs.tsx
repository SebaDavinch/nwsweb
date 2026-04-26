import { Badge } from "../ui/badge";
import { AdminContentManager } from "./admin-content-manager";

interface HubItem {
  id: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  status: string;
}

export function AdminHubs() {
  return (
    <AdminContentManager<HubItem>
      collection="hubs"
      title="Hubs"
      subtitle="Maintain active bases and operational hub mapping."
      singularLabel="Hub"
      searchKeys={["icao", "name", "city", "country"]}
      filterKeys={["status", "country"]}
      columns={[
        {
          key: "name",
          label: "Hub",
          render: (item) => (
            <div>
              <div className="font-medium text-gray-900">{item.name}</div>
              <div className="text-xs text-gray-500">{item.icao}</div>
            </div>
          ),
        },
        { key: "city", label: "City" },
        { key: "country", label: "Country" },
        {
          key: "status",
          label: "Status",
          render: (item) => <Badge variant="outline">{item.status || "active"}</Badge>,
        },
      ]}
      fields={[
        { key: "icao", label: "ICAO", type: "text", placeholder: "UUEE" },
        { key: "name", label: "Name", type: "text" },
        { key: "city", label: "City", type: "text" },
        { key: "country", label: "Country", type: "text" },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Active", value: "active" },
            { label: "Planned", value: "planned" },
            { label: "Closed", value: "closed" },
          ],
        },
        { key: "order", label: "Order", type: "number" },
        { key: "notes", label: "Notes", type: "textarea" },
      ]}
    />
  );
}