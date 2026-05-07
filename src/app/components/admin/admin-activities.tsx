import { Badge } from "../ui/badge";
import { AdminContentManager } from "./admin-content-manager";
import { Button } from "../ui/button";
import { useSiteDesign } from "../../hooks/use-site-design";
import { useLanguage } from "../../context/language-context";

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
  bannerUrl?: string;
  published?: boolean;
  featured?: boolean;
  target?: string;
  summary?: string;
  content?: string;
}

export function AdminActivities() {
  const design = useSiteDesign();
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  const openBannerGenerator = (formData: Record<string, string | boolean>) => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URL("/admin/banner-generator", window.location.origin);
    const push = (key: string, value: string | boolean | undefined) => {
      const normalized = String(value ?? "").trim();
      if (normalized) {
        params.searchParams.set(key, normalized);
      }
    };

    push("title", formData.title);
    push("category", formData.category);
    push("type", formData.type);
    push("tag", formData.tag);
    push("summary", formData.summary);
    push("author", formData.author);
    push("date", formData.date);
    push("target", formData.target);
    push("brand", design.siteTitle);

    window.open(params.toString(), "_blank", "noopener,noreferrer");
  };

  return (
    <AdminContentManager<ActivityItem>
      collection="activities"
      title={tr("Активности", "Activities")}
      subtitle={tr("Управляйте публичной страницей активностей с ручными записями новостей, событий и NOTAM.", "Manage the public activities page with manual news, event, and NOTAM entries.")}
      singularLabel={tr("Активность", "Activity")}
      searchKeys={["title", "category", "type", "author", "tag", "summary", "content", "bannerUrl"]}
      filterKeys={["category", "status", "type"]}
      renderFieldExtras={({ field, formData }) => {
        if (field.key !== "bannerUrl") {
          return null;
        }

        return (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-gray-200 bg-gray-50/80 px-3 py-2">
            <span className="text-xs text-gray-500">{tr("Открыть встроенный генератор баннеров с уже заполненными полями текущей активности, затем сохранить локальный ассет и вставить полученный URL сюда.", "Open the embedded banner generator with current activity fields prefilled, save the local asset, then paste the resulting URL here.")}</span>
            <Button type="button" variant="outline" size="sm" onClick={() => openBannerGenerator(formData)}>
              {tr("Открыть генератор", "Open generator")}
            </Button>
          </div>
        );
      }}
      columns={[
        {
          key: "bannerUrl",
          label: tr("Баннер", "Banner"),
          render: (item) => item.bannerUrl ? (
            <div className="h-12 w-24 overflow-hidden rounded-lg border border-gray-200 bg-gray-100">
              <img src={item.bannerUrl} alt={item.title || tr("Баннер", "Banner")} className="h-full w-full object-cover" loading="lazy" />
            </div>
          ) : tr("—", "—"),
        },
        { key: "title", label: tr("Активность", "Activity") },
        {
          key: "category",
          label: tr("Категория", "Category"),
          render: (item) => <Badge variant="outline">{item.category || tr("Новость", "News")}</Badge>,
        },
        {
          key: "status",
          label: tr("Статус", "Status"),
          render: (item) => <Badge variant="outline">{item.status || tr("Опубликовано", "Published")}</Badge>,
        },
        { key: "author", label: tr("Автор", "Author") },
        { key: "date", label: tr("Дата", "Date") },
      ]}
      fields={[
        { key: "title", label: tr("Заголовок", "Title"), type: "text" },
        {
          key: "category",
          label: tr("Категория", "Category"),
          type: "select",
          options: [
            { label: tr("Новость", "News"), value: "News" },
            { label: tr("Событие", "Event"), value: "Event" },
          ],
        },
        {
          key: "type",
          label: tr("Тип", "Type"),
          type: "select",
          options: [
            { label: tr("Новость", "News"), value: "news" },
            { label: tr("Событие", "Event"), value: "event" },
            { label: tr("Операции", "Operations"), value: "ops" },
            { label: tr("Комьюнити", "Community"), value: "community" },
          ],
        },
        {
          key: "status",
          label: tr("Статус", "Status"),
          type: "select",
          options: [
            { label: tr("Опубликовано", "Published"), value: "Published" },
            { label: tr("Черновик", "Draft"), value: "Draft" },
            { label: tr("Архив", "Archived"), value: "Archived" },
          ],
        },
        { key: "author", label: tr("Автор", "Author"), type: "text" },
        { key: "date", label: tr("Дата", "Date"), type: "text", placeholder: "2026-04-18" },
        { key: "tag", label: tr("Тег", "Tag"), type: "text" },
        { key: "linkUrl", label: tr("Ссылка", "Link"), type: "text", placeholder: "https://..." },
        { key: "bannerUrl", label: tr("URL баннера", "Banner URL"), type: "text", placeholder: "https://cdn.example.com/banner.webp" },
        { key: "target", label: tr("Цель", "Target"), type: "text" },
        { key: "summary", label: tr("Краткое описание", "Summary"), type: "textarea" },
        { key: "content", label: tr("Содержимое", "Content"), type: "textarea" },
        { key: "published", label: tr("Опубликовано", "Published"), type: "checkbox" },
        { key: "featured", label: tr("Рекомендуемое", "Featured"), type: "checkbox" },
        { key: "order", label: tr("Порядок", "Order"), type: "number" },
        { key: "views", label: tr("Просмотры", "Views"), type: "number" },
      ]}
    />
  );
}