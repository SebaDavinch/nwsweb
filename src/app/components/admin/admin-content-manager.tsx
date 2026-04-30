import { useEffect, useMemo, useState, type ReactNode } from "react";
import { ExternalLink, Plus, Search, Trash2, Pencil } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";

type AdminFieldType = "text" | "textarea" | "number" | "select" | "checkbox" | "datetime" | "color";

interface AdminFieldOption {
  label: string;
  value: string;
}

interface AdminFormField {
  key: string;
  label: string;
  type: AdminFieldType;
  placeholder?: string;
  options?: AdminFieldOption[];
}

interface AdminColumn<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface AdminContentManagerProps<T extends { id: string }> {
  collection: string;
  title: string;
  subtitle: string;
  singularLabel: string;
  columns: AdminColumn<T>[];
  fields: AdminFormField[];
  searchKeys: Array<keyof T | string>;
  filterKeys?: Array<keyof T | string>;
  itemFilter?: (item: T) => boolean;
  fixedValues?: Record<string, string | boolean | number>;
  toolbarActions?: ReactNode;
  renderFieldExtras?: (args: {
    field: AdminFormField;
    value: string | boolean;
    formData: Record<string, string | boolean>;
    updateFormValue: (key: string, value: string | boolean) => void;
  }) => ReactNode;
  reloadToken?: string | number;
}

const getInitialFieldValue = (field: AdminFormField) => {
  if (field.type === "checkbox") {
    return false;
  }
  return "";
};

const createInitialFormData = (fields: AdminFormField[]) =>
  fields.reduce<Record<string, string | boolean>>((accumulator, field) => {
    accumulator[field.key] = getInitialFieldValue(field);
    return accumulator;
  }, {});

const normalizeFilterValue = (value: unknown) => String(value || "").trim();

const renderPrimitiveValue = (value: unknown) => {
  if (typeof value === "boolean") {
    return (
      <Badge variant="outline" className={value ? "border-green-200 bg-green-50 text-green-700" : "border-gray-200 bg-gray-50 text-gray-700"}>
        {value ? "Yes" : "No"}
      </Badge>
    );
  }

  const normalized = normalizeFilterValue(value);
  return normalized || "—";
};

const looksLikeImageUrl = (value: string) => /^(https?:)?\/\//i.test(value);

export function AdminContentManager<T extends { id: string }>({
  collection,
  title,
  subtitle,
  singularLabel,
  columns,
  fields,
  searchKeys,
  filterKeys = [],
  itemFilter,
  fixedValues,
  toolbarActions,
  renderFieldExtras,
  reloadToken,
}: AdminContentManagerProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<T | null>(null);
  const [formData, setFormData] = useState<Record<string, string | boolean>>(createInitialFormData(fields));
  const [isSaving, setIsSaving] = useState(false);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/admin/content/${collection}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load items");
      }
      const payload = await response.json();
      const nextItems = (Array.isArray(payload?.items) ? payload.items : []) as T[];
      setItems(itemFilter ? nextItems.filter((item: T) => itemFilter(item)) : nextItems);
    } catch (error) {
      console.error(`Failed to load ${collection}`, error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, reloadToken]);

  const filterOptions = useMemo(() => {
    return filterKeys.reduce<Record<string, string[]>>((accumulator, key) => {
      const uniqueValues = Array.from(
        new Set(
          items
            .map((item) => normalizeFilterValue(item[key as keyof T]))
            .filter(Boolean)
        )
      ).sort((left, right) => left.localeCompare(right));
      accumulator[String(key)] = uniqueValues;
      return accumulator;
    }, {});
  }, [filterKeys, items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !query ||
        searchKeys.some((key) => normalizeFilterValue(item[key as keyof T]).toLowerCase().includes(query));

      const matchesFilters = filterKeys.every((key) => {
        const filterValue = filters[String(key)] || "all";
        if (filterValue === "all") {
          return true;
        }
        return normalizeFilterValue(item[key as keyof T]) === filterValue;
      });

      return matchesSearch && matchesFilters;
    });
  }, [filterKeys, filters, items, search, searchKeys]);

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData(createInitialFormData(fields));
    setDialogOpen(true);
  };

  const openEditDialog = (item: T) => {
    setEditingItem(item);
    setFormData(
      fields.reduce<Record<string, string | boolean>>((accumulator, field) => {
        const rawValue = item[field.key as keyof T];
        accumulator[field.key] = field.type === "checkbox" ? Boolean(rawValue) : normalizeFilterValue(rawValue);
        return accumulator;
      }, {})
    );
    setDialogOpen(true);
  };

  const updateFormValue = (key: string, value: string | boolean) => {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = fields.reduce<Record<string, string | boolean | number>>((accumulator, field) => {
        const rawValue = formData[field.key];
        if (field.type === "number") {
          accumulator[field.key] = Number(rawValue || 0) || 0;
        } else {
          accumulator[field.key] = rawValue;
        }
        return accumulator;
      }, {});

      if (fixedValues) {
        Object.assign(payload, fixedValues);
      }

      const url = editingItem
        ? `/api/admin/content/${collection}/${editingItem.id}`
        : `/api/admin/content/${collection}`;
      const response = await fetch(url, {
        method: editingItem ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save item");
      }

      await loadItems();
      setDialogOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error(`Failed to save ${collection}`, error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: T) => {
    if (!window.confirm(`Delete this ${singularLabel.toLowerCase()}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/content/${collection}/${item.id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete item");
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
          <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
          <p className="text-sm text-gray-500">{subtitle}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {toolbarActions}
          <Button className="bg-[#E31E24] hover:bg-[#c41a20] text-white" onClick={openCreateDialog}>
            <Plus className="h-4 w-4" />
            Add {singularLabel}
          </Button>
        </div>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder={`Search ${title.toLowerCase()}...`}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              {filterKeys.map((key) => (
                <Select
                  key={String(key)}
                  value={filters[String(key)] || "all"}
                  onValueChange={(value) =>
                    setFilters((current) => ({
                      ...current,
                      [String(key)]: value,
                    }))
                  }
                >
                  <SelectTrigger className="w-full sm:w-48">
                    <SelectValue placeholder={String(key)} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All {String(key)}</SelectItem>
                    {(filterOptions[String(key)] || []).map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ))}
            </div>
          </div>

          <div className="rounded-md border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  {columns.map((column) => (
                    <TableHead key={column.key}>{column.label}</TableHead>
                  ))}
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="py-10 text-center text-gray-500">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length + 1} className="py-10 text-center text-gray-500">
                      No {title.toLowerCase()} found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      {columns.map((column) => (
                        <TableCell key={column.key} className="align-top">
                          {column.render ? column.render(item) : renderPrimitiveValue(item[column.key as keyof T])}
                        </TableCell>
                      ))}
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(item)}>
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(item)}>
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? `Edit ${singularLabel}` : `Create ${singularLabel}`}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2">
            {fields.map((field) => {
              const value = formData[field.key];
              const isFullWidth = field.type === "textarea";

              return (
                <div key={field.key} className={isFullWidth ? "space-y-2 md:col-span-2" : "space-y-2"}>
                  <Label htmlFor={field.key}>{field.label}</Label>
                  {field.type === "textarea" ? (
                    <Textarea
                      id={field.key}
                      placeholder={field.placeholder}
                      className="min-h-36"
                      value={String(value || "")}
                      onChange={(event) => updateFormValue(field.key, event.target.value)}
                    />
                  ) : field.type === "select" ? (
                    <Select value={String(value || "")} onValueChange={(nextValue) => updateFormValue(field.key, nextValue)}>
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
                    <div className="flex h-9 items-center rounded-md border border-gray-200 px-3">
                      <Checkbox
                        id={field.key}
                        checked={Boolean(value)}
                        onCheckedChange={(checked) => updateFormValue(field.key, Boolean(checked))}
                      />
                      <Label htmlFor={field.key} className="ml-3 text-sm text-gray-700">
                        Enabled
                      </Label>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Input
                        id={field.key}
                        type={field.type === "number" ? "number" : field.type === "datetime" ? "datetime-local" : field.type}
                        placeholder={field.placeholder}
                        value={String(value || "")}
                        onChange={(event) => updateFormValue(field.key, event.target.value)}
                      />
                      {field.key === "bannerUrl" && looksLikeImageUrl(String(value || "")) ? (
                        <div className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                          <div className="aspect-[16/6] w-full overflow-hidden bg-gray-100">
                            <img
                              src={String(value || "")}
                              alt="Banner preview"
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-gray-500">
                            <span className="truncate">Banner preview</span>
                            <a
                              href={String(value || "")}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[#E31E24] hover:text-[#c41a20]"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              Open
                            </a>
                          </div>
                        </div>
                      ) : null}
                      {renderFieldExtras ? renderFieldExtras({ field, value, formData, updateFormValue }) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#E31E24] hover:bg-[#c41a20] text-white" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingItem ? "Save changes" : `Create ${singularLabel}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}