import { Badge } from "../ui/badge";
import { AdminContentManager } from "./admin-content-manager";

interface BadgeItem {
  id: string;
  title: string;
  code: string;
  color: string;
  active: boolean;
  criteria: string;
}

export function AdminBadges() {
  return (
    <AdminContentManager<BadgeItem>
      collection="badges"
      title="Badges"
      subtitle="Manage badge catalog, descriptions and activation state."
      singularLabel="Badge"
      searchKeys={["title", "code", "criteria"]}
      filterKeys={["active"]}
      columns={[
        {
          key: "title",
          label: "Badge",
          render: (item) => (
            <div className="flex items-center gap-3">
              <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color || "#E31E24" }} />
              <div>
                <div className="font-medium text-gray-900">{item.title}</div>
                <div className="text-xs text-gray-500">{item.code}</div>
              </div>
            </div>
          ),
        },
        { key: "criteria", label: "Criteria" },
        {
          key: "active",
          label: "State",
          render: (item) => (
            <Badge variant="outline" className={item.active ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-700"}>
              {item.active ? "Active" : "Disabled"}
            </Badge>
          ),
        },
      ]}
      fields={[
        { key: "title", label: "Title", type: "text" },
        { key: "code", label: "Code", type: "text" },
        { key: "color", label: "Color", type: "color" },
        { key: "active", label: "Active", type: "checkbox" },
        { key: "order", label: "Order", type: "number" },
        { key: "criteria", label: "Criteria", type: "text" },
        { key: "description", label: "Description", type: "textarea" },
      ]}
    />
  );
}