import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Edit, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

type AdminFieldType = "text" | "textarea" | "number" | "checkbox" | "color" | "datetime-local" | "select";

interface AdminFieldOption {
  label: string;
  value: string;
}

interface AdminFieldDefinition {
  key: string;
  label: string;
  type?: AdminFieldType;
  placeholder?: string;
  options?: AdminFieldOption[];
  table?: boolean;
}

type AdminFormState = Record<string, string | boolean>;
type AdminItem = Record<string, unknown>;

interface AdminCollectionPageProps {
  title: string;
  subtitle: string;
  collection: string;
  createLabel: string;
  fields: AdminFieldDefinition[];
}

interface AdminActivityCatalogItem {
  id: string;
  originalId: number;
  type: string;
  name: string;
  description?: string | null;
  start?: string | null;
  end?: string | null;
  status?: string | null;
  target?: string | null;
  registrationCount?: number | null;
  completionCount?: number | null;
  updatedAt?: string | null;
}

const toDisplayValue = (value: unknown) => {
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  return String(value);
};

const getItemState = (item: AdminItem) => {
  if (typeof item.status === "string" && item.status.trim()) {
    return item.status.trim().toLowerCase();
  }
  if (typeof item.published === "boolean") {
    return item.published ? "published" : "draft";
  }
  if (typeof item.active === "boolean") {
    return item.active ? "active" : "inactive";
  }
  return "";
};

const buildInitialState = (fields: AdminFieldDefinition[], item?: AdminItem | null): AdminFormState => {
  const nextState: AdminFormState = {};
  fields.forEach((field) => {
    const rawValue = item?.[field.key];
    if (field.type === "checkbox") {
      nextState[field.key] = Boolean(rawValue);
      return;
    }

    nextState[field.key] = rawValue === null || rawValue === undefined ? "" : String(rawValue);
  });
  return nextState;
};

function AdminCollectionPage({ title, subtitle, collection, createLabel, fields }: AdminCollectionPageProps) {
  const [items, setItems] = useState<AdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminItem | null>(null);
  const [formState, setFormState] = useState<AdminFormState>(() => buildInitialState(fields));

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/content/${collection}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to load collection");
      }
      const payload = await response.json();
      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error) {
      console.error(`Failed to load ${collection}`, error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems().catch(() => undefined);
  }, [collection]);

  const tableFields = useMemo(
    () => fields.filter((field) => field.table !== false).slice(0, 4),
    [fields]
  );

  const stateOptions = useMemo(() => {
    const values = Array.from(new Set(items.map((item) => getItemState(item)).filter(Boolean)));
    return values.sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !query ||
        fields.some((field) => String(item[field.key] ?? "").toLowerCase().includes(query)) ||
        String(item.id ?? "").toLowerCase().includes(query);

      const itemState = getItemState(item);
      const matchesState = stateFilter === "all" || itemState === stateFilter;
      return matchesSearch && matchesState;
    });
  }, [fields, items, search, stateFilter]);

  const openCreate = () => {
    setEditingItem(null);
    setFormState(buildInitialState(fields));
    setIsDialogOpen(true);
  };

  const openEdit = (item: AdminItem) => {
    setEditingItem(item);
    setFormState(buildInitialState(fields, item));
    setIsDialogOpen(true);
  };

  const setFieldValue = (key: string, value: string | boolean) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSubmit = async () => {
    const payload: Record<string, string | number | boolean | null> = {};
    fields.forEach((field) => {
      const rawValue = formState[field.key];
      if (field.type === "checkbox") {
        payload[field.key] = Boolean(rawValue);
        return;
      }
      if (field.type === "number") {
        payload[field.key] = rawValue === "" ? null : Number(rawValue);
        return;
      }
      payload[field.key] = String(rawValue ?? "");
    });

    const isEdit = Boolean(editingItem?.id);
    const url = isEdit
      ? `/api/admin/content/${collection}/${encodeURIComponent(String(editingItem?.id || ""))}`
      : `/api/admin/content/${collection}`;

    try {
      const response = await fetch(url, {
        method: isEdit ? "PUT" : "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error("Save failed");
      }
      setIsDialogOpen(false);
      await loadItems();
    } catch (error) {
      console.error(`Failed to save ${collection}`, error);
    }
  };

  const handleDelete = async (item: AdminItem) => {
    const confirmed = window.confirm(`Delete ${String(item.title || item.name || item.id || "item")}?`);
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/content/${collection}/${encodeURIComponent(String(item.id || ""))}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Delete failed");
      }
      await loadItems();
    } catch (error) {
      console.error(`Failed to delete ${collection}`, error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <Button className="bg-[#E31E24] hover:bg-[#c41a20]" onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {createLabel}
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-md">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={`Search ${title.toLowerCase()}...`}
                className="pl-9"
              />
            </div>
            {stateOptions.length > 0 ? (
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-full lg:w-52">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {stateOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  {tableFields.map((field) => (
                    <th key={field.key} className="px-4 py-3 font-medium">
                      {field.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={tableFields.length + 3} className="px-4 py-8 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <tr key={String(item.id)} className="hover:bg-gray-50">
                      {tableFields.map((field) => (
                        <td key={field.key} className="px-4 py-3 align-top text-gray-700">
                          {field.type === "color" ? (
                            <div className="flex items-center gap-2">
                              <span
                                className="h-4 w-4 rounded-full border border-gray-200"
                                style={{ backgroundColor: String(item[field.key] || "#000000") }}
                              />
                              <span>{toDisplayValue(item[field.key])}</span>
                            </div>
                          ) : field.type === "checkbox" ? (
                            <Badge
                              variant="outline"
                              className={item[field.key]
                                ? "border-green-200 bg-green-50 text-green-700"
                                : "border-gray-200 bg-gray-50 text-gray-700"}
                            >
                              {item[field.key] ? "Enabled" : "Disabled"}
                            </Badge>
                          ) : (
                            <span className={field.key === "content" ? "line-clamp-2 max-w-xl" : undefined}>
                              {toDisplayValue(item[field.key])}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                          {getItemState(item) || "n/a"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{String(item.updatedAt || "—").slice(0, 16).replace("T", " ")}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={tableFields.length + 3} className="px-4 py-8 text-center text-gray-500">
                      No items found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingItem ? `Edit ${title}` : createLabel}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-2 md:grid-cols-2">
            {fields.map((field) => {
              const currentValue = formState[field.key];
              return (
                <div
                  key={field.key}
                  className={field.type === "textarea" ? "space-y-2 md:col-span-2" : "space-y-2"}
                >
                  <Label htmlFor={`${collection}-${field.key}`}>{field.label}</Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={`${collection}-${field.key}`}
                      value={String(currentValue ?? "")}
                      placeholder={field.placeholder}
                      className="min-h-[140px]"
                      onChange={(event) => setFieldValue(field.key, event.target.value)}
                    />
                  ) : field.type === "select" ? (
                    <Select value={String(currentValue ?? "")} onValueChange={(value) => setFieldValue(field.key, value)}>
                      <SelectTrigger>
                        <SelectValue placeholder={field.placeholder || field.label} />
                      </SelectTrigger>
                      <SelectContent>
                        {(field.options || []).map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === "checkbox" ? (
                    <div className="flex min-h-10 items-center rounded-md border px-3">
                      <Checkbox
                        id={`${collection}-${field.key}`}
                        checked={Boolean(currentValue)}
                        onCheckedChange={(checked) => setFieldValue(field.key, Boolean(checked))}
                      />
                    </div>
                  ) : (
                    <Input
                      id={`${collection}-${field.key}`}
                      type={field.type === "color" ? "color" : field.type === "number" ? "number" : field.type === "datetime-local" ? "datetime-local" : "text"}
                      value={String(currentValue ?? "")}
                      placeholder={field.placeholder}
                      onChange={(event) => setFieldValue(field.key, event.target.value)}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#E31E24] hover:bg-[#c41a20]" onClick={handleSubmit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminDocuments() {
  return (
    <AdminCollectionPage
      title="Documents"
      subtitle="Edit published VAC documents, create new pages and retire outdated content."
      collection="documents"
      createLabel="New document"
      fields={[
        { key: "title", label: "Title" },
        { key: "slug", label: "Slug" },
        { key: "category", label: "Category" },
        { key: "description", label: "Description" },
        { key: "content", label: "Content", type: "textarea", table: false },
        { key: "published", label: "Published", type: "checkbox" },
        { key: "order", label: "Order", type: "number" },
      ]}
    />
  );
}

export function AdminEvents() {
  const [items, setItems] = useState<AdminActivityCatalogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;

    const loadItems = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/admin/activities", {
          credentials: "include",
        });
        if (!response.ok) {
          throw new Error("Failed to load activities");
        }
        const payload = await response.json() as { activities?: AdminActivityCatalogItem[] };
        const activities = Array.isArray(payload?.activities) ? payload.activities : [];
        if (!active) {
          return;
        }
        setItems(
          activities.filter((item) => String(item?.type || "").toLowerCase() === "event")
        );
      } catch (error) {
        console.error("Failed to load admin events", error);
        if (active) {
          setItems([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadItems();
    return () => {
      active = false;
    };
  }, []);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return items;
    }

    return items.filter((item) =>
      [item.name, item.description, item.status, item.target]
        .map((value) => String(value || "").toLowerCase())
        .some((value) => value.includes(query))
    );
  }, [items, search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Events</h2>
        <p className="text-sm text-gray-500">Live event catalog from vAMSYS Operations API.</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search events..."
              className="pl-9"
            />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Scheduled</th>
                  <th className="px-4 py-3 font-medium">Location</th>
                  <th className="px-4 py-3 font-medium">State</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Loading events...
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 align-top text-gray-700">
                        <div className="font-medium text-gray-900">{item.name || `Event ${item.originalId}`}</div>
                        {item.description ? (
                          <div className="mt-1 line-clamp-2 max-w-xl text-xs text-gray-500">{item.description}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 capitalize">
                          {item.status || "n/a"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        <div className="inline-flex items-center gap-2 text-sm">
                          <CalendarDays className="h-4 w-4 text-gray-400" />
                          <span>{String(item.start || "—").replace("T", " ").slice(0, 16)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">{item.target || "—"}</td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        <div className="space-y-1 text-xs text-gray-500">
                          <div>Regs: {Number(item.registrationCount || 0)}</div>
                          <div>Done: {Number(item.completionCount || 0)}</div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-gray-500">
                        {String(item.updatedAt || "—").replace("T", " ").slice(0, 16)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      No events found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export function AdminStaff() {
  return (
    <AdminCollectionPage
      title="VA Staff"
      subtitle="Maintain staff roles, contacts and department ownership."
      collection="staff"
      createLabel="Add staff"
      fields={[
        { key: "name", label: "Name" },
        { key: "role", label: "Role" },
        { key: "division", label: "Division" },
        { key: "email", label: "Email" },
        { key: "discord", label: "Discord" },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Active", value: "active" },
            { label: "On leave", value: "leave" },
            { label: "Archived", value: "archived" },
          ],
        },
        { key: "bio", label: "Bio", type: "textarea", table: false },
        { key: "order", label: "Order", type: "number" },
      ]}
    />
  );
}

export function AdminBadges() {
  return (
    <AdminCollectionPage
      title="Badges"
      subtitle="Configure badge catalog entries and award criteria metadata."
      collection="badges"
      createLabel="New badge"
      fields={[
        { key: "title", label: "Title" },
        { key: "code", label: "Code" },
        { key: "color", label: "Color", type: "color" },
        { key: "description", label: "Description" },
        { key: "criteria", label: "Criteria", type: "textarea", table: false },
        { key: "active", label: "Active", type: "checkbox" },
        { key: "order", label: "Order", type: "number" },
      ]}
    />
  );
}

export function AdminActivities() {
  return (
    <AdminCollectionPage
      title="Activities"
      subtitle="Track activity blocks, automation targets and recurring work queues."
      collection="activities"
      createLabel="New activity"
      fields={[
        { key: "title", label: "Title" },
        {
          key: "type",
          label: "Type",
          type: "select",
          options: [
            { label: "News", value: "news" },
            { label: "Event", value: "event" },
            { label: "Automation", value: "automation" },
            { label: "Roster", value: "roster" },
          ],
        },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Active", value: "active" },
            { label: "Paused", value: "paused" },
            { label: "Archived", value: "archived" },
          ],
        },
        { key: "target", label: "Target" },
        { key: "description", label: "Description", type: "textarea", table: false },
        { key: "order", label: "Order", type: "number" },
      ]}
    />
  );
}

export function AdminHubs() {
  return (
    <AdminCollectionPage
      title="Hubs"
      subtitle="Maintain operational hubs and their assigned airports."
      collection="hubs"
      createLabel="New hub"
      fields={[
        { key: "name", label: "Name" },
        { key: "icao", label: "ICAO" },
        { key: "city", label: "City" },
        { key: "country", label: "Country" },
        {
          key: "status",
          label: "Status",
          type: "select",
          options: [
            { label: "Active", value: "active" },
            { label: "Seasonal", value: "seasonal" },
            { label: "Archived", value: "archived" },
          ],
        },
        { key: "notes", label: "Notes", type: "textarea", table: false },
        { key: "order", label: "Order", type: "number" },
      ]}
    />
  );
}
