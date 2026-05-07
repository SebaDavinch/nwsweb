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
import { useLanguage } from "../../context/language-context";

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

interface AdminFormTemplate {
  id: string;
  label: string;
  description?: string;
  defaults: Record<string, string | boolean | number>;
}

type AdminFormState = Record<string, string | boolean>;
type AdminItem = Record<string, unknown>;

interface AdminCollectionPageProps {
  title: string;
  subtitle: string;
  collection: string;
  createLabel: string;
  fields: AdminFieldDefinition[];
  templates?: AdminFormTemplate[];
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

const toDisplayValue = (value: unknown, tr?: (ru: string, en: string) => string) => {
  if (typeof value === "boolean") {
    return value ? (tr ? tr("Да", "Yes") : "Yes") : (tr ? tr("Нет", "No") : "No");
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

function AdminCollectionPage({ title, subtitle, collection, createLabel, fields, templates = [] }: AdminCollectionPageProps) {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminItem | null>(null);
  const [formState, setFormState] = useState<AdminFormState>(() => buildInitialState(fields));
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/content/${collection}`, {
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(tr("Не удалось загрузить коллекцию", "Failed to load collection"));
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
    setSelectedTemplateId("");
    setIsDialogOpen(true);
  };

  const openEdit = (item: AdminItem) => {
    setEditingItem(item);
    setFormState(buildInitialState(fields, item));
    setSelectedTemplateId("");
    setIsDialogOpen(true);
  };

  const applyTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((item) => item.id === templateId) || null;
    if (!template) {
      return;
    }

    setFormState((current) => {
      const nextState = { ...current };
      Object.entries(template.defaults).forEach(([key, value]) => {
        nextState[key] = typeof value === "boolean" ? value : String(value ?? "");
      });
      return nextState;
    });
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
        throw new Error(tr("Не удалось сохранить элемент", "Failed to save item"));
      }
      setIsDialogOpen(false);
      await loadItems();
    } catch (error) {
      console.error(`Failed to save ${collection}`, error);
    }
  };

  const handleDelete = async (item: AdminItem) => {
    const confirmed = window.confirm(
      tr(
        `Удалить ${String(item.title || item.name || item.id || "элемент")}?`,
        `Delete ${String(item.title || item.name || item.id || "item")}?`
      )
    );
    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/content/${collection}/${encodeURIComponent(String(item.id || ""))}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(tr("Не удалось удалить элемент", "Failed to delete item"));
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
                placeholder={tr(`Поиск: ${title.toLowerCase()}...`, `Search: ${title.toLowerCase()}...`)}
                className="pl-9"
              />
            </div>
            {stateOptions.length > 0 ? (
              <Select value={stateFilter} onValueChange={setStateFilter}>
                <SelectTrigger className="w-full lg:w-52">
                  <SelectValue placeholder={tr("Все статусы", "All statuses")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr("Все статусы", "All statuses")}</SelectItem>
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
                  <th className="px-4 py-3 font-medium">{tr("Состояние", "State")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Обновлено", "Updated")}</th>
                  <th className="px-4 py-3 text-right font-medium">{tr("Действия", "Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={tableFields.length + 3} className="px-4 py-8 text-center text-gray-500">
                      {tr("Загрузка...", "Loading...")}
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
                              {item[field.key] ? tr("Включено", "Enabled") : tr("Выключено", "Disabled")}
                            </Badge>
                          ) : (
                            <span className={field.key === "content" ? "line-clamp-2 max-w-xl" : undefined}>
                              {toDisplayValue(item[field.key], tr)}
                            </span>
                          )}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                          {getItemState(item) || tr("н/д", "n/a")}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{String(item.updatedAt || "—").slice(0, 16).replace("T", " ")}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                            <Edit className="mr-2 h-4 w-4" />
                            {tr("Изменить", "Edit")}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {tr("Удалить", "Delete")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={tableFields.length + 3} className="px-4 py-8 text-center text-gray-500">
                      {tr("Элементы не найдены.", "No items found.")}
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
            <DialogTitle>{editingItem ? tr(`Изменить: ${title}`, `Edit: ${title}`) : createLabel}</DialogTitle>
          </DialogHeader>
          {templates.length > 0 ? (
            <div className="space-y-2 rounded-lg border border-dashed border-gray-200 bg-gray-50/70 p-4">
              <Label htmlFor={`${collection}-template`}>{tr("Шаблон", "Template")}</Label>
              <Select value={selectedTemplateId || "none"} onValueChange={(value) => applyTemplate(value === "none" ? "" : value)}>
                <SelectTrigger id={`${collection}-template`}>
                  <SelectValue placeholder={tr("Выберите шаблон", "Select template")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tr("Без шаблона", "No template")}</SelectItem>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplateId ? (
                <div className="text-xs text-gray-500">
                  {templates.find((item) => item.id === selectedTemplateId)?.description || ""}
                </div>
              ) : null}
            </div>
          ) : null}
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
              {tr("Отмена", "Cancel")}
            </Button>
            <Button className="bg-[#E31E24] hover:bg-[#c41a20]" onClick={handleSubmit}>
              {tr("Сохранить", "Save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminDocuments() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  return (
    <AdminCollectionPage
      title={tr("Документы", "Documents")}
      subtitle={tr(
        "Редактируйте опубликованные VAC-документы, создавайте новые страницы и выводите устаревший контент из обращения.",
        "Edit published VAC documents, create new pages, and retire outdated content."
      )}
      collection="documents"
      createLabel={tr("Новый документ", "New document")}
      fields={[
        { key: "title", label: tr("Заголовок", "Title") },
        { key: "slug", label: "Slug" },
        { key: "category", label: tr("Категория", "Category") },
        { key: "description", label: tr("Описание", "Description") },
        { key: "content", label: tr("Содержимое", "Content"), type: "textarea", table: false },
        { key: "published", label: tr("Опубликовано", "Published"), type: "checkbox" },
        { key: "order", label: tr("Порядок", "Order"), type: "number" },
      ]}
    />
  );
}

export function AdminEvents() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);
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
          throw new Error(tr("Не удалось загрузить активности", "Failed to load activities"));
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
        <h2 className="text-2xl font-bold text-gray-800">{tr("События", "Events")}</h2>
        <p className="text-sm text-gray-500">{tr("Живой каталог событий из vAMSYS Operations API.", "Live catalog of events from vAMSYS Operations API.")}</p>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={tr("Поиск событий...", "Search events...")}
              className="pl-9"
            />
          </div>

          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-3 font-medium">{tr("Заголовок", "Title")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Статус", "Status")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Запланировано", "Scheduled")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Локация", "Location")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Состояние", "State")}</th>
                  <th className="px-4 py-3 font-medium">{tr("Обновлено", "Updated")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                      <div className="inline-flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {tr("Загрузка событий...", "Loading events...")}
                      </div>
                    </td>
                  </tr>
                ) : filteredItems.length > 0 ? (
                  filteredItems.map((item) => (
                    <tr key={item.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 align-top text-gray-700">
                        <div className="font-medium text-gray-900">{item.name || tr(`Событие ${item.originalId}`, `Event ${item.originalId}`)}</div>
                        {item.description ? (
                          <div className="mt-1 line-clamp-2 max-w-xl text-xs text-gray-500">{item.description}</div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top text-gray-700">
                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700 capitalize">
                          {item.status || tr("н/д", "n/a")}
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
                          <div>{tr("Регистраций", "Registrations")}: {Number(item.registrationCount || 0)}</div>
                          <div>{tr("Завершено", "Completed")}: {Number(item.completionCount || 0)}</div>
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
                      {tr("События не найдены.", "Events not found.")}
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
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  const staffRoleTemplates: AdminFormTemplate[] = [
    {
      id: "operations-management",
      label: tr("Управление операциями", "Operations management"),
      description: tr(
        "Для Chief Operations, диспетчеров и руководителей маршрутной сети.",
        "For Chief Operations, dispatchers, and route network managers."
      ),
      defaults: {
        role: tr("Менеджер операций", "Operations manager"),
        division: tr("Операции", "Operations"),
        status: "active",
        bio: tr(
          "Координирует ежедневные операции, качество маршрутной сети и поддержку пилотов.",
          "Coordinates daily operations, route quality, and pilot support."
        ),
      },
    },
    {
      id: "training-management",
      label: tr("Отдел обучения", "Training department"),
      description: tr(
        "Для инструкторов, экзаменаторов и сотрудников онбординга.",
        "For instructors, examiners, and onboarding staff."
      ),
      defaults: {
        role: tr("Менеджер обучения", "Training manager"),
        division: tr("Обучение", "Training"),
        status: "active",
        bio: tr(
          "Отвечает за ввод пилотов, стандарты подготовки и периодические проверки.",
          "Oversees pilot onboarding, training standards, and periodic checks."
        ),
      },
    },
    {
      id: "events-community",
      label: tr("События и комьюнити", "Events and community"),
      description: tr(
        "Для организаторов событий, медиа и внешних коммуникаций.",
        "For event organizers, media, and external communications."
      ),
      defaults: {
        role: tr("Координатор событий", "Events coordinator"),
        division: tr("Комьюнити", "Community"),
        status: "active",
        bio: tr(
          "Координирует события, коммуникации и внешнюю активность сообщества.",
          "Coordinates events, communications, and external community activities."
        ),
      },
    },
    {
      id: "hr-admin",
      label: tr("HR и рекрутинг", "HR and recruiting"),
      description: tr(
        "Для ведения состава, найма и внутренних кадровых процессов.",
        "For team management, hiring, and internal HR processes."
      ),
      defaults: {
        role: tr("HR-менеджер", "HR manager"),
        division: "HR",
        status: "active",
        bio: tr(
          "Ведёт штатное расписание, процесс набора и внутренние кадровые задачи.",
          "Manages staffing plans, hiring workflow, and internal HR tasks."
        ),
      },
    },
    {
      id: "executive-management",
      label: tr("Исполнительное руководство", "Executive leadership"),
      description: tr(
        "Для директоров, руководителей и ролей стратегического надзора.",
        "For directors, heads, and strategic oversight roles."
      ),
      defaults: {
        role: tr("Исполнительный директор", "Executive director"),
        division: tr("Руководство", "Leadership"),
        status: "active",
        bio: tr(
          "Обеспечивает стратегическое руководство, координацию отделов и управленческий контроль.",
          "Provides strategic leadership, cross-team coordination, and management oversight."
        ),
      },
    },
  ];

  return (
    <AdminCollectionPage
      title={tr("Персонал VA", "VA staff")}
      subtitle={tr("Управляйте ролями персонала, контактами и закреплением отделов.", "Manage staff roles, contacts, and department assignments.")}
      collection="staff"
      createLabel={tr("Новый сотрудник", "New staff member")}
      templates={staffRoleTemplates}
      fields={[
        { key: "name", label: tr("Имя", "Name") },
        { key: "role", label: tr("Роль", "Role") },
        { key: "division", label: tr("Отдел", "Department") },
        { key: "email", label: "Email" },
        { key: "discord", label: "Discord" },
        {
          key: "status",
          label: tr("Статус", "Status"),
          type: "select",
          options: [
            { label: tr("Активен", "Active"), value: "active" },
            { label: tr("В отпуске", "On leave"), value: "leave" },
            { label: tr("Архив", "Archived"), value: "archived" },
          ],
        },
        { key: "bio", label: tr("О себе", "Bio"), type: "textarea", table: false },
        { key: "order", label: tr("Порядок", "Order"), type: "number" },
      ]}
    />
  );
}

export function AdminBadges() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  return (
    <AdminCollectionPage
      title={tr("Награды", "Badges")}
      subtitle={tr("Настраивайте каталог наград и метаданные критериев выдачи.", "Configure the badge catalog and award criteria metadata.")}
      collection="badges"
      createLabel={tr("Новая награда", "New badge")}
      fields={[
        { key: "title", label: tr("Название", "Title") },
        { key: "code", label: tr("Код", "Code") },
        { key: "color", label: tr("Цвет", "Color"), type: "color" },
        { key: "description", label: tr("Описание", "Description") },
        { key: "criteria", label: tr("Критерии", "Criteria"), type: "textarea", table: false },
        { key: "active", label: tr("Активна", "Active"), type: "checkbox" },
        { key: "order", label: tr("Порядок", "Order"), type: "number" },
      ]}
    />
  );
}

export function AdminActivities() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  return (
    <AdminCollectionPage
      title={tr("Активности", "Activities")}
      subtitle={tr(
        "Отслеживайте блоки активностей, цели автоматизации и регулярные рабочие очереди.",
        "Track activity streams, automation targets, and recurring work queues."
      )}
      collection="activities"
      createLabel={tr("Новая активность", "New activity")}
      fields={[
        { key: "title", label: tr("Заголовок", "Title") },
        {
          key: "type",
          label: tr("Тип", "Type"),
          type: "select",
          options: [
            { label: tr("Новость", "News"), value: "news" },
            { label: tr("Событие", "Event"), value: "event" },
            { label: tr("Автоматизация", "Automation"), value: "automation" },
            { label: tr("Ростер", "Roster"), value: "roster" },
          ],
        },
        {
          key: "status",
          label: tr("Статус", "Status"),
          type: "select",
          options: [
            { label: tr("Активно", "Active"), value: "active" },
            { label: tr("На паузе", "Paused"), value: "paused" },
            { label: tr("Архив", "Archived"), value: "archived" },
          ],
        },
        { key: "target", label: tr("Цель", "Target") },
        { key: "description", label: tr("Описание", "Description"), type: "textarea", table: false },
        { key: "order", label: tr("Порядок", "Order"), type: "number" },
      ]}
    />
  );
}

export function AdminHubs() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  return (
    <AdminCollectionPage
      title={tr("Хабы", "Hubs")}
      subtitle={tr("Поддерживайте операционные хабы и закреплённые за ними аэропорты.", "Maintain operational hubs and their assigned airports.")}
      collection="hubs"
      createLabel={tr("Новый хаб", "New hub")}
      fields={[
        { key: "name", label: tr("Название", "Name") },
        { key: "icao", label: "ICAO" },
        { key: "city", label: tr("Город", "City") },
        { key: "country", label: tr("Страна", "Country") },
        {
          key: "status",
          label: tr("Статус", "Status"),
          type: "select",
          options: [
            { label: tr("Активен", "Active"), value: "active" },
            { label: tr("Сезонный", "Seasonal"), value: "seasonal" },
            { label: tr("Архив", "Archived"), value: "archived" },
          ],
        },
        { key: "notes", label: tr("Заметки", "Notes"), type: "textarea", table: false },
        { key: "order", label: tr("Порядок", "Order"), type: "number" },
      ]}
    />
  );
}
