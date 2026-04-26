import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bold,
  Code2,
  Eye,
  FileText,
  Heading2,
  Italic,
  Link2,
  List,
  ListOrdered,
  Pencil,
  Plus,
  Quote,
  Search,
  Split,
  Trash2,
} from "lucide-react";
import { DocumentContentFormat, DocumentRenderer } from "../document-renderer";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Checkbox } from "../ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { ScrollArea } from "../ui/scroll-area";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Textarea } from "../ui/textarea";

interface DocumentItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  description: string;
  content: string;
  contentFormat?: DocumentContentFormat | string;
  published: boolean;
  order: number;
  updatedAt: string;
}

interface DocumentFormState {
  title: string;
  slug: string;
  category: string;
  description: string;
  content: string;
  contentFormat: DocumentContentFormat;
  published: boolean;
  order: string;
}

type EditorMode = "write" | "preview" | "split";

type ContentEditResult = {
  nextContent: string;
  selectionStart: number;
  selectionEnd: number;
};

const FORMAT_OPTIONS: Array<{ value: DocumentContentFormat; label: string; description: string }> = [
  { value: "markdown", label: "Markdown", description: "Best for structured rules and long-form docs." },
  { value: "html", label: "HTML", description: "Advanced layout with sanitized HTML rendering." },
  { value: "plain", label: "Plain text", description: "Raw text with preserved line breaks." },
];

const createEmptyForm = (): DocumentFormState => ({
  title: "",
  slug: "",
  category: "General",
  description: "",
  content: "",
  contentFormat: "markdown",
  published: true,
  order: "0",
});

const normalizeFormat = (value: unknown): DocumentContentFormat => {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "html" || normalized === "plain") {
    return normalized;
  }
  return "markdown";
};

const buildFormState = (item?: DocumentItem | null): DocumentFormState => ({
  title: String(item?.title || ""),
  slug: String(item?.slug || ""),
  category: String(item?.category || "General"),
  description: String(item?.description || ""),
  content: String(item?.content || ""),
  contentFormat: normalizeFormat(item?.contentFormat),
  published: Boolean(item?.published ?? true),
  order: String(item?.order ?? 0),
});

export function AdminDocuments() {
  const [items, setItems] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [visibilityFilter, setVisibilityFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DocumentItem | null>(null);
  const [formData, setFormData] = useState<DocumentFormState>(createEmptyForm);
  const [editorMode, setEditorMode] = useState<EditorMode>("split");
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const loadItems = async () => {
    setIsLoading(true);
    try {
      const response = await fetch("/api/admin/content/documents", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to load documents");
      }

      const payload = await response.json();
      const nextItems = (Array.isArray(payload?.items) ? payload.items : []) as DocumentItem[];
      setItems(
        nextItems.slice().sort((left, right) => {
          const orderDelta = Number(left.order || 0) - Number(right.order || 0);
          if (orderDelta !== 0) {
            return orderDelta;
          }
          return String(left.title || "").localeCompare(String(right.title || ""));
        })
      );
    } catch (error) {
      console.error("Failed to load documents", error);
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadItems().catch(() => undefined);
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => String(item.category || "").trim()).filter(Boolean))).sort(),
    [items]
  );

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesSearch =
        !query ||
        [item.title, item.slug, item.category, item.description]
          .some((value) => String(value || "").toLowerCase().includes(query));
      const matchesCategory = categoryFilter === "all" || String(item.category || "") === categoryFilter;
      const matchesVisibility =
        visibilityFilter === "all" ||
        (visibilityFilter === "published" ? item.published : !item.published);
      return matchesSearch && matchesCategory && matchesVisibility;
    });
  }, [categoryFilter, items, search, visibilityFilter]);

  const updateFormValue = <K extends keyof DocumentFormState>(key: K, value: DocumentFormState[K]) => {
    setFormData((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const openCreateDialog = () => {
    setEditingItem(null);
    setFormData(createEmptyForm());
    setEditorMode("split");
    setDialogOpen(true);
  };

  const openEditDialog = (item: DocumentItem) => {
    setEditingItem(item);
    setFormData(buildFormState(item));
    setEditorMode("split");
    setDialogOpen(true);
  };

  const applyContentEdit = (
    transformer: (content: string, start: number, end: number, selected: string) => ContentEditResult
  ) => {
    const textarea = textareaRef.current;
    const currentContent = formData.content;
    const selectionStart = textarea?.selectionStart ?? currentContent.length;
    const selectionEnd = textarea?.selectionEnd ?? currentContent.length;
    const selectedText = currentContent.slice(selectionStart, selectionEnd);
    const result = transformer(currentContent, selectionStart, selectionEnd, selectedText);

    updateFormValue("content", result.nextContent);

    requestAnimationFrame(() => {
      const currentTextarea = textareaRef.current;
      if (!currentTextarea) {
        return;
      }
      currentTextarea.focus();
      currentTextarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  };

  const wrapSelection = (prefix: string, suffix: string, placeholder: string) => {
    applyContentEdit((content, start, end, selected) => {
      const inserted = `${prefix}${selected || placeholder}${suffix}`;
      const nextContent = `${content.slice(0, start)}${inserted}${content.slice(end)}`;
      const innerStart = start + prefix.length;
      const innerEnd = innerStart + (selected || placeholder).length;
      return {
        nextContent,
        selectionStart: innerStart,
        selectionEnd: innerEnd,
      };
    });
  };

  const prefixSelectedLines = (prefix: string, placeholder: string) => {
    applyContentEdit((content, start, end, selected) => {
      const source = selected || placeholder;
      const prefixed = source
        .split("\n")
        .map((line) => `${prefix}${line}`)
        .join("\n");
      const nextContent = `${content.slice(0, start)}${prefixed}${content.slice(end)}`;
      return {
        nextContent,
        selectionStart: start,
        selectionEnd: start + prefixed.length,
      };
    });
  };

  const insertBlock = (block: string, cursorOffset = 0) => {
    applyContentEdit((content, start, end) => {
      const nextContent = `${content.slice(0, start)}${block}${content.slice(end)}`;
      const caret = start + (cursorOffset || block.length);
      return {
        nextContent,
        selectionStart: caret,
        selectionEnd: caret,
      };
    });
  };

  const markdownToolbar = [
    { label: "Bold", icon: Bold, action: () => wrapSelection("**", "**", "bold text") },
    { label: "Italic", icon: Italic, action: () => wrapSelection("*", "*", "italic text") },
    { label: "Heading", icon: Heading2, action: () => insertBlock("## Section title", 3) },
    { label: "Bullets", icon: List, action: () => prefixSelectedLines("- ", "List item") },
    { label: "Numbers", icon: ListOrdered, action: () => prefixSelectedLines("1. ", "List item") },
    { label: "Quote", icon: Quote, action: () => prefixSelectedLines("> ", "Quoted text") },
    { label: "Code", icon: Code2, action: () => wrapSelection("```\n", "\n```", "code") },
    { label: "Link", icon: Link2, action: () => wrapSelection("[", "](https://example.com)", "link text") },
  ];

  const htmlToolbar = [
    { label: "H2", icon: Heading2, action: () => wrapSelection("<h2>", "</h2>", "Section title") },
    { label: "Paragraph", icon: Pencil, action: () => wrapSelection("<p>", "</p>", "Paragraph") },
    { label: "Bullets", icon: List, action: () => insertBlock("<ul>\n  <li>Item</li>\n</ul>", 11) },
    { label: "Quote", icon: Quote, action: () => wrapSelection("<blockquote>", "</blockquote>", "Quoted text") },
    { label: "Code", icon: Code2, action: () => wrapSelection("<pre><code>", "</code></pre>", "code") },
    { label: "Link", icon: Link2, action: () => wrapSelection("<a href=\"https://example.com\">", "</a>", "link text") },
  ];

  const activeToolbar =
    formData.contentFormat === "html"
      ? htmlToolbar
      : formData.contentFormat === "markdown"
        ? markdownToolbar
        : [];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        title: formData.title,
        slug: formData.slug,
        category: formData.category,
        description: formData.description,
        content: formData.content,
        contentFormat: formData.contentFormat,
        published: formData.published,
        order: Number(formData.order || 0) || 0,
      };

      const url = editingItem
        ? `/api/admin/content/documents/${encodeURIComponent(editingItem.id)}`
        : "/api/admin/content/documents";
      const response = await fetch(url, {
        method: editingItem ? "PUT" : "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to save document");
      }

      await loadItems();
      setDialogOpen(false);
      setEditingItem(null);
    } catch (error) {
      console.error("Failed to save document", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (item: DocumentItem) => {
    if (!window.confirm(`Delete document "${item.title}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/content/documents/${encodeURIComponent(item.id)}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      await loadItems();
    } catch (error) {
      console.error("Failed to delete document", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Documents</h2>
          <p className="text-sm text-gray-500">Rich editor, preview and publishing controls for VAC policies and guides.</p>
        </div>
        <Button className="bg-[#E31E24] text-white hover:bg-[#c41a20]" onClick={openCreateDialog}>
          <Plus className="h-4 w-4" />
          New document
        </Button>
      </div>

      <Card className="border-none shadow-sm">
        <CardContent className="space-y-4 p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-sm">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                className="pl-9"
                placeholder="Search documents..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={visibilityFilter} onValueChange={setVisibilityFilter}>
                <SelectTrigger className="w-full sm:w-40">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-md border border-gray-200 bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Document</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-gray-500">
                      No documents found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <div className="font-medium text-gray-900">{item.title}</div>
                          <div className="text-xs text-gray-500">/{item.slug}</div>
                          <div className="line-clamp-2 max-w-xl text-sm text-gray-500">{item.description || "No description"}</div>
                        </div>
                      </TableCell>
                      <TableCell>{item.category || "General"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                          {normalizeFormat(item.contentFormat)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={item.published ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}
                        >
                          {item.published ? "Published" : "Draft"}
                        </Badge>
                      </TableCell>
                      <TableCell>{String(item.updatedAt || "—").slice(0, 16).replace("T", " ")}</TableCell>
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
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-6xl">
          <DialogHeader>
            <DialogTitle>{editingItem ? `Edit ${editingItem.title}` : "Create document"}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 py-2 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="document-title">Title</Label>
              <Input
                id="document-title"
                placeholder="Document title"
                value={formData.title}
                onChange={(event) => updateFormValue("title", event.target.value)}
              />
            </div>
            <div className="space-y-2 xl:col-span-2">
              <Label htmlFor="document-slug">Slug</Label>
              <Input
                id="document-slug"
                placeholder="document-slug"
                value={formData.slug}
                onChange={(event) => updateFormValue("slug", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-category">Category</Label>
              <Input
                id="document-category"
                placeholder="Rules"
                value={formData.category}
                onChange={(event) => updateFormValue("category", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="document-order">Order</Label>
              <Input
                id="document-order"
                type="number"
                value={formData.order}
                onChange={(event) => updateFormValue("order", event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Format</Label>
              <Select
                value={formData.contentFormat}
                onValueChange={(value) => updateFormValue("contentFormat", normalizeFormat(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Format" />
                </SelectTrigger>
                <SelectContent>
                  {FORMAT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Published</Label>
              <div className="flex h-10 items-center rounded-md border border-gray-200 px-3">
                <Checkbox
                  id="document-published"
                  checked={formData.published}
                  onCheckedChange={(checked) => updateFormValue("published", Boolean(checked))}
                />
                <Label htmlFor="document-published" className="ml-3 text-sm text-gray-700">
                  Visible on the public website
                </Label>
              </div>
            </div>
            <div className="space-y-2 md:col-span-2 xl:col-span-4">
              <Label htmlFor="document-description">Description</Label>
              <Textarea
                id="document-description"
                placeholder="Short summary for cards and previews"
                className="min-h-20"
                value={formData.description}
                onChange={(event) => updateFormValue("description", event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">Document editor</div>
                <p className="text-xs text-gray-500">
                  {FORMAT_OPTIONS.find((option) => option.value === formData.contentFormat)?.description}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeToolbar.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Button key={item.label} type="button" variant="outline" size="sm" onClick={item.action}>
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Button>
                  );
                })}
                {formData.contentFormat === "plain" ? (
                  <Badge variant="outline" className="border-gray-200 bg-white text-gray-600">
                    Plain text keeps line breaks only
                  </Badge>
                ) : null}
              </div>
            </div>

            <Tabs value={editorMode} onValueChange={(value) => setEditorMode(value as EditorMode)}>
              <TabsList>
                <TabsTrigger value="write">
                  <FileText className="h-4 w-4" />
                  Write
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye className="h-4 w-4" />
                  Preview
                </TabsTrigger>
                <TabsTrigger value="split">
                  <Split className="h-4 w-4" />
                  Split
                </TabsTrigger>
              </TabsList>

              <TabsContent value="write" className="mt-4">
                <Textarea
                  ref={textareaRef}
                  placeholder={formData.contentFormat === "html" ? "<h2>Document content</h2>" : "# Document content"}
                  className="min-h-[420px] bg-white font-mono text-sm"
                  value={formData.content}
                  onChange={(event) => updateFormValue("content", event.target.value)}
                />
              </TabsContent>

              <TabsContent value="preview" className="mt-4">
                <ScrollArea className="h-[420px] rounded-xl border border-gray-200 bg-white p-6">
                  <DocumentRenderer
                    content={formData.content}
                    format={formData.contentFormat}
                    emptyMessage="Start typing to preview the document."
                  />
                </ScrollArea>
              </TabsContent>

              <TabsContent value="split" className="mt-4">
                <div className="grid gap-4 xl:grid-cols-2">
                  <Textarea
                    ref={textareaRef}
                    placeholder={formData.contentFormat === "html" ? "<h2>Document content</h2>" : "# Document content"}
                    className="min-h-[420px] bg-white font-mono text-sm"
                    value={formData.content}
                    onChange={(event) => updateFormValue("content", event.target.value)}
                  />
                  <ScrollArea className="h-[420px] rounded-xl border border-gray-200 bg-white p-6">
                    <DocumentRenderer
                      content={formData.content}
                      format={formData.contentFormat}
                      emptyMessage="Start typing to preview the document."
                    />
                  </ScrollArea>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button className="bg-[#E31E24] text-white hover:bg-[#c41a20]" onClick={handleSave} disabled={isSaving}>
              {isSaving ? "Saving..." : editingItem ? "Save changes" : "Create document"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
