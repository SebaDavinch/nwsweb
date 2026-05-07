import { Badge } from "../ui/badge";
import { AdminContentManager } from "./admin-content-manager";
import { useLanguage } from "../../context/language-context";

interface HubItem {
  id: string;
  icao: string;
  name: string;
  city: string;
  country: string;
  status: string;
}

export function AdminHubs() {
  const { language } = useLanguage();
  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  return (
    <AdminContentManager<HubItem>
      collection="hubs"
      title={tr("Хабы", "Hubs")}
      subtitle={tr("Поддерживайте актуальные базы и операционные привязки хабов.", "Maintain up-to-date hub bases and operational assignments.")}
      singularLabel={tr("Хаб", "Hub")}
      searchKeys={["icao", "name", "city", "country"]}
      filterKeys={["status", "country"]}
      columns={[
        {
          key: "name",
          label: tr("Хаб", "Hub"),
          render: (item) => (
            <div>
              <div className="font-medium text-gray-900">{item.name}</div>
              <div className="text-xs text-gray-500">{item.icao}</div>
            </div>
          ),
        },
        { key: "city", label: tr("Город", "City") },
        { key: "country", label: tr("Страна", "Country") },
        {
          key: "status",
          label: tr("Статус", "Status"),
          render: (item) => <Badge variant="outline">{item.status || "active"}</Badge>,
        },
      ]}
      fields={[
        { key: "icao", label: "ICAO", type: "text", placeholder: "UUEE" },
        { key: "name", label: tr("Название", "Name"), type: "text" },
        { key: "city", label: tr("Город", "City"), type: "text" },
        { key: "country", label: tr("Страна", "Country"), type: "text" },
        {
          key: "status",
          label: tr("Статус", "Status"),
          type: "select",
          options: [
            { label: tr("Активен", "Active"), value: "active" },
            { label: tr("Запланирован", "Planned"), value: "planned" },
            { label: tr("Закрыт", "Closed"), value: "closed" },
          ],
        },
        { key: "order", label: tr("Порядок", "Order"), type: "number" },
        { key: "notes", label: tr("Заметки", "Notes"), type: "textarea" },
      ]}
    />
  );
}
