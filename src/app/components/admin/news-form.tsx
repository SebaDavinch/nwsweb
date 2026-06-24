import { useState, useEffect } from "react";
import { MessageSquare, Send, Globe } from "lucide-react";
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
import { Switch } from "../ui/switch";
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
  category: "News" | "NOTAM" | "Alert";
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
  sendToTelegram: boolean;
  sendToVK: boolean;
  bannerUrl?: string | null;
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
  const [sendToTelegram, setSendToTelegram] = useState(false);
  const [sendToVK, setSendToVK] = useState(false);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
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
      setSendToTelegram(Boolean(initialData.sendToTelegram));
      setSendToVK(Boolean(initialData.sendToVK));
      setBannerUrl(initialData.bannerUrl ?? null);
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
      setSendToTelegram(false);
      setSendToVK(false);
      setBannerUrl(null);
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
        sendToTelegram,
        sendToVK,
        bannerUrl: bannerUrl || null,
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
      setSendToTelegram(false);
      setSendToVK(false);
      setBannerUrl(null);
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
                  <SelectItem value="Published">Опубликовано</SelectItem>
                  <SelectItem value="Draft">Черновик</SelectItem>
                  <SelectItem value="Archived">Архив</SelectItem>
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
                  <Label>{t("admin.news.form.notamType") || "Тип NOTAM"}</Label>
                  <Select value={notamType} onValueChange={(value) => setNotamType(value as NonNullable<NewsFormData["notamType"]>)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">{t("admin.news.form.notamType.info") || "Информация"}</SelectItem>
                      <SelectItem value="warning">{t("admin.news.form.notamType.warning") || "Предупреждение"}</SelectItem>
                      <SelectItem value="critical">{t("admin.news.form.notamType.critical") || "Критично"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("admin.news.form.priority") || "Приоритет"}</Label>
                  <Select value={notamPriority} onValueChange={(value) => setNotamPriority(value as NonNullable<NewsFormData["notamPriority"]>)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">{t("admin.news.form.priority.low") || "Низкий"}</SelectItem>
                      <SelectItem value="medium">{t("admin.news.form.priority.medium") || "Средний"}</SelectItem>
                      <SelectItem value="high">{t("admin.news.form.priority.high") || "Высокий"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>{t("admin.news.form.tag") || "Тег"}</Label>
                  <Input
                    placeholder="OPS"
                    value={notamTag}
                    onChange={(e) => setNotamTag(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("admin.news.form.referenceUrl") || "Ссылка-источник"}</Label>
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
                <Label htmlFor="must-read">{t("admin.news.form.mustRead") || "Обязательно к прочтению"}</Label>
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

          {/* Banner */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Баннер публикации</div>
            <Input
              placeholder="https://cdn.example.com/banner.webp"
              value={bannerUrl ?? ""}
              onChange={(e) => setBannerUrl(e.target.value || null)}
            />
            {bannerUrl && (
              <img src={bannerUrl} alt="banner" className="w-full max-h-48 rounded-xl object-cover border border-gray-200" />
            )}
          </div>

          {/* Publication channels */}
          <div className="space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500">Публикация</div>
            <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
              {/* Discord */}
              <div className="flex items-center gap-3 px-4 py-3 bg-indigo-50/60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                  <MessageSquare className="h-4 w-4 text-indigo-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-indigo-900">Discord</div>
                  <div className="text-xs text-indigo-600 truncate">{t("admin.news.form.discordDesc")}</div>
                </div>
                <Switch checked={sendToDiscord} onCheckedChange={setSendToDiscord} className="data-[state=checked]:bg-indigo-600" />
              </div>
              {/* Telegram */}
              <div className="flex items-center gap-3 px-4 py-3 bg-sky-50/60">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-100">
                  <Send className="h-4 w-4 text-sky-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-sky-900">Telegram</div>
                  <div className="text-xs text-sky-600 truncate">Отправить уведомление в Telegram-канал</div>
                </div>
                <Switch checked={sendToTelegram} onCheckedChange={setSendToTelegram} className="data-[state=checked]:bg-sky-500" />
              </div>
              {/* VK */}
              <div className="flex flex-col">
                <div className="flex items-center gap-3 px-4 py-3 bg-blue-50/60">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                    <Globe className="h-4 w-4 text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-blue-900">ВКонтакте</div>
                    <div className="text-xs text-blue-600 truncate">
                      Опубликовать пост в сообщество{bannerUrl ? " · с баннером" : ""}
                    </div>
                  </div>
                  <Switch checked={sendToVK} onCheckedChange={setSendToVK} className="data-[state=checked]:bg-blue-600" />
                </div>
                {/* VK preview — inline under VK row */}
                {sendToVK && (
                  <div className="border-t border-blue-100 bg-blue-50/30 px-4 py-4 space-y-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-500">Так будет выглядеть пост</div>
                    <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden font-sans">
                      {bannerUrl && (
                        <img src={bannerUrl} alt="banner" className="w-full max-h-52 object-cover" />
                      )}
                      <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-full bg-red-600 flex items-center justify-center text-white font-bold text-base leading-none select-none shrink-0">N</div>
                          <div>
                            <div className="font-semibold text-[#000000de] text-[13px]">Nordwind Virtual</div>
                            <div className="text-[11px] text-gray-400">только что</div>
                          </div>
                        </div>
                        <div className="whitespace-pre-wrap text-[13px] leading-[1.5] text-[#000000de] break-words">
                          {`[${category.toUpperCase()}] ${title || "Заголовок"}\n\n${content ? (content.length > 300 ? content.slice(0, 300) + "…" : content) : "Текст записи..."}`}
                          {notamUrl && `\n\n${category === "News" ? "Полная версия новости" : "Подробнее"}: ${notamUrl}`}
                          {"\n\nАвтор: Admin"}
                        </div>
                        <div className="flex items-center gap-4 pt-2 border-t border-gray-100 text-gray-400 text-[12px]">
                          <span>♥ Нравится</span>
                          <span>💬 Комментировать</span>
                          <span>↗ Поделиться</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
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
