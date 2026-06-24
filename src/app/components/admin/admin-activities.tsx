import { Badge } from "../ui/badge";
import { AdminContentManager } from "./admin-content-manager";
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
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  return (
    <AdminContentManager<ActivityItem>
      collection="activities"
      title={tr("Активности", "Activities")}
      subtitle={tr("Управляйте публичной страницей активностей с ручными записями новостей, событий и NOTAM.", "Manage the public activities page with manual news, event, and NOTAM entries.")}
      singularLabel={tr("Активность", "Activity")}
      searchKeys={["title", "category", "type", "author", "tag", "summary", "content", "bannerUrl"]}
      filterKeys={["category", "status", "type"]}
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
        { key: "sendToDiscord", label: tr("Опубликовать в Discord", "Publish to Discord"), type: "checkbox" },
        { key: "sendToTelegram", label: tr("Опубликовать в Telegram", "Publish to Telegram"), type: "checkbox" },
        { key: "sendToVK", label: tr("Опубликовать ВКонтакте", "Publish to VK"), type: "checkbox" },
        { key: "order", label: tr("Порядок", "Order"), type: "number" },
        { key: "views", label: tr("Просмотры", "Views"), type: "number" },
      ]}
    />
  );
}