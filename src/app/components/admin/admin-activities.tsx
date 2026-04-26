import { Badge } from "../ui/badge";
import { AdminContentManager } from "./admin-content-manager";

interface ActivityItem {
  id: string;
  category: "News" | "Event";
  title: string;
  type: string;
  status: "Published" | "Draft" | "Archived";
  author?: string;
  date?: string;
  tag?: string;
  linkUrl?: string;
  published?: boolean;
  featured?: boolean;
  target?: string;
  summary?: string;
  content?: string;
}

export function AdminActivities() {
  return (
    <AdminContentManager<ActivityItem>
      collection="activities"
      title="Activities"
      subtitle="Manage the public Activities page with fully manual News, Event, and NOTAM entries."
      singularLabel="Activity"
      searchKeys={["title", "category", "type", "author", "tag", "summary", "content"]}
      filterKeys={["category", "status", "type"]}
      columns={[
        { key: "title", label: "Activity" },
        {
          key: "category",
          label: "Category",
          render: (item) => <Badge variant="outline">{item.category || "News"}</Badge>,
        },
        {
          key: "status",
          label: "Status",
          render: (item) => <Badge variant="outline">{item.status || "Published"}</Badge>,
        },
        { key: "author", label: "Author" },
        { key: "date", label: "Date" },
      ]}
      fields={[
        { key: "title", label: "Title", type: "text" },
        {
          key: "category",
          label: "Category",
          type: "select",
          options: [
            { label: "News", value: "News" },
            { label: "Event", value: "Event" },
          ],
        },
        {
          key: "type",
          label: "Type",
          type: "select",
          options: [
            { label: "News", value: "news" },
            { label: "Event", value: "event" },
            { label: "Ops", value: "ops" },
            { label: "Community", value: "community" },
          ],
        },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Published", value: "Published" },
            { label: "Draft", value: "Draft" },
            { label: "Archived", value: "Archived" },
          ],
        },
        { key: "author", label: "Author", type: "text" },
        { key: "date", label: "Date", type: "text", placeholder: "2026-04-18" },
        { key: "tag", label: "Tag", type: "text" },
        { key: "linkUrl", label: "Link URL", type: "text", placeholder: "https://..." },
        { key: "target", label: "Target", type: "text" },
        { key: "summary", label: "Summary", type: "textarea" },
        { key: "content", label: "Content", type: "textarea" },
        { key: "published", label: "Published", type: "checkbox" },
        { key: "featured", label: "Featured", type: "checkbox" },
        { key: "order", label: "Order", type: "number" },
        { key: "views", label: "Views", type: "number" },
      ]}
    />
  );
}