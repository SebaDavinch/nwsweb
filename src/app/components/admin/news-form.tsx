import { useState, useEffect } from "react";
import { Send } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Checkbox } from "../ui/checkbox";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog";
import { useLanguage } from "../../context/language-context";

export interface NewsFormData {
  title: string;
  category: "News" | "NOTAM" | "Event" | "Alert";
  notamType?: "info" | "warning" | "critical";
  notamPriority?: "low" | "medium" | "high";
  mustRead?: boolean;
  tag?: string | null;
  linkUrl?: string | null;
  alertPages?: string[];
  alertOrder?: number;
  alertStartShowing?: string | null;
  alertStopShowing?: string | null;
  content: string;
  sendToDiscord: boolean;
  status: "Published" | "Draft" | "Archived";
  date: string;
  author: string;
}

interface NewsFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: NewsFormData) => Promise<void> | void;
  initialData?: Partial<NewsFormData> | null;
}

export function NewsForm({ open, onOpenChange, onSubmit, initialData }: NewsFormProps) {
  const { t } = useLanguage();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<NewsFormData["category"]>("News");
  const [notamType, setNotamType] = useState<NonNullable<NewsFormData["notamType"]>>("info");
  const [notamPriority, setNotamPriority] = useState<NonNullable<NewsFormData["notamPriority"]>>("low");
  const [mustRead, setMustRead] = useState(false);
  const [notamTag, setNotamTag] = useState("");
  const [notamUrl, setNotamUrl] = useState("");
  const [alertPages, setAlertPages] = useState("dashboard");
  const [alertOrder, setAlertOrder] = useState("0");
  const [alertStartShowing, setAlertStartShowing] = useState("");
  const [alertStopShowing, setAlertStopShowing] = useState("");
  const [content, setContent] = useState("");
  const [sendToDiscord, setSendToDiscord] = useState(false);
  const [status, setStatus] = useState<NewsFormData["status"]>("Published");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialData) {
      setTitle(String(initialData.title || ""));
      setCategory((initialData.category as NewsFormData["category"]) || "News");
      setNotamType(initialData.notamType || "info");
      setNotamPriority(initialData.notamPriority || "low");
      setMustRead(Boolean(initialData.mustRead));
      setNotamTag(String(initialData.tag || ""));
      setNotamUrl(String(initialData.linkUrl || ""));
      setAlertPages(Array.isArray(initialData.alertPages) && initialData.alertPages.length > 0 ? initialData.alertPages.join(", ") : "dashboard");
      setAlertOrder(String(initialData.alertOrder ?? 0));
      setAlertStartShowing(String(initialData.alertStartShowing || ""));
      setAlertStopShowing(String(initialData.alertStopShowing || ""));
      setContent(String(initialData.content || ""));
      setSendToDiscord(Boolean(initialData.sendToDiscord));
      setStatus(initialData.status || "Published");
    } else {
      setTitle("");
      setCategory("News");
      setNotamType("info");
      setNotamPriority("low");
      setMustRead(false);
      setNotamTag("");
      setNotamUrl("");
      setAlertPages("dashboard");
      setAlertOrder("0");
      setAlertStartShowing("");
      setAlertStopShowing("");
      setContent("");
      setSendToDiscord(false);
      setStatus("Published");
    }
  }, [initialData, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      await onSubmit({
        title,
        category,
        notamType,
        notamPriority,
        mustRead,
        tag: notamTag.trim() || null,
        linkUrl: notamUrl.trim() || null,
        alertPages: alertPages
          .split(",")
          .map((item) => item.trim().toLowerCase())
          .filter(Boolean),
        alertOrder: Number(alertOrder || 0) || 0,
        alertStartShowing: alertStartShowing || null,
        alertStopShowing: alertStopShowing || null,
        content,
        sendToDiscord,
        status,
        date: new Date().toISOString().split('T')[0],
        author: "Admin"
      });
      onOpenChange(false);
      setTitle("");
      setNotamType("info");
      setNotamPriority("low");
      setMustRead(false);
      setNotamTag("");
      setNotamUrl("");
      setAlertPages("dashboard");
      setAlertOrder("0");
      setAlertStartShowing("");
      setAlertStopShowing("");
      setContent("");
      setSendToDiscord(false);
      setStatus("Published");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[860px] max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initialData ? t("admin.news.editPost") : t("admin.news.create")}</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="category">{t("news.category")}</Label>
              <Select value={category} onValueChange={(value) => setCategory(value as NewsFormData["category"])}>
                <SelectTrigger>
                  <SelectValue placeholder={t("admin.news.form.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alert">{t("admin.news.form.category.alert")}</SelectItem>
                  <SelectItem value="News">{t("news.cat.news")}</SelectItem>
                  <SelectItem value="NOTAM">{t("news.cat.notam")}</SelectItem>
                  <SelectItem value="Event">{t("news.cat.event")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="title">{t("admin.news.table.title")}</Label>
              <Input
                id="title"
                placeholder={t("admin.news.form.enterTitle")}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">{t("admin.news.table.status")}</Label>
              <Select value={status} onValueChange={(value) => setStatus(value as NewsFormData["status"])}>
                <SelectTrigger id="status">
                  <SelectValue placeholder={t("admin.news.table.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Published">Published</SelectItem>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">{t("admin.news.form.content")}</Label>
            <Textarea
              id="content"
              placeholder={t("admin.news.form.contentPlaceholder")}
              className="min-h-[200px]"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              required
            />
          </div>

          {category === "NOTAM" && (
            <div className="space-y-4 rounded-lg border border-orange-200 bg-orange-50 p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>{t("admin.news.form.notamType") || "NOTAM Type"}</Label>
                  <Select value={notamType} onValueChange={(value) => setNotamType(value as NonNullable<NewsFormData["notamType"]>)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">{t("admin.news.form.notamType.info") || "Info"}</SelectItem>
                      <SelectItem value="warning">{t("admin.news.form.notamType.warning") || "Warning"}</SelectItem>
                      <SelectItem value="critical">{t("admin.news.form.notamType.critical") || "Critical"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("admin.news.form.priority") || "Priority"}</Label>
                  <Select value={notamPriority} onValueChange={(value) => setNotamPriority(value as NonNullable<NewsFormData["notamPriority"]>)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t("admin.news.form.priority.low") || "Low"}</SelectItem>
                      <SelectItem value="medium">{t("admin.news.form.priority.medium") || "Medium"}</SelectItem>
                      <SelectItem value="high">{t("admin.news.form.priority.high") || "High"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("admin.news.form.tag") || "Tag"}</Label>
                  <Input
                    placeholder="OPS"
                    value={notamTag}
                    onChange={(e) => setNotamTag(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("admin.news.form.referenceUrl") || "Reference URL"}</Label>
                <Input
                  placeholder="https://..."
                  value={notamUrl}
                  onChange={(e) => setNotamUrl(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="must-read"
                  checked={mustRead}
                  onCheckedChange={(checked) => setMustRead(Boolean(checked))}
                />
                <Label htmlFor="must-read">{t("admin.news.form.mustRead") || "Must read"}</Label>
              </div>
            </div>
          )}

          {category === "Alert" && (
            <div className="space-y-4 rounded-lg border border-sky-200 bg-sky-50 p-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="space-y-2">
                  <Label>{t("admin.news.form.alertType")}</Label>
                  <Select value={notamType} onValueChange={(value) => setNotamType(value as NonNullable<NewsFormData["notamType"]>)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">{t("admin.news.form.notamType.info")}</SelectItem>
                      <SelectItem value="warning">{t("admin.news.form.notamType.warning")}</SelectItem>
                      <SelectItem value="critical">{t("admin.news.form.notamType.critical")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("admin.news.form.alertPages")}</Label>
                  <Input value={alertPages} onChange={(e) => setAlertPages(e.target.value)} placeholder="dashboard, pegasus" />
                </div>

                <div className="space-y-2">
                  <Label>{t("admin.news.form.alertOrder")}</Label>
                  <Input type="number" value={alertOrder} onChange={(e) => setAlertOrder(e.target.value)} />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>{t("admin.news.form.alertStart")}</Label>
                  <Input type="datetime-local" value={alertStartShowing} onChange={(e) => setAlertStartShowing(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>{t("admin.news.form.alertStop")}</Label>
                  <Input type="datetime-local" value={alertStopShowing} onChange={(e) => setAlertStopShowing(e.target.value)} />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2 rounded-lg border p-4 bg-indigo-50 border-indigo-100">
            <Checkbox 
              id="discord" 
              checked={sendToDiscord}
              onCheckedChange={(checked) => setSendToDiscord(checked as boolean)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="discord"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-indigo-900"
              >
                {t("admin.news.form.discord")}
              </Label>
              <p className="text-xs text-indigo-700">
                {t("admin.news.form.discordDesc")}
              </p>
            </div>
            <Send className="ml-auto h-4 w-4 text-indigo-500" />
          </div>
          
          <DialogFooter className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("admin.news.form.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting} className="bg-[#E31E24] hover:bg-[#c41a20]">
              {isSubmitting ? t("admin.news.form.publishing") : t("admin.news.form.publish")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
