import { useEffect, useMemo, useState } from "react";
import { AtSign, ShieldCheck } from "lucide-react";
import { useLanguage } from "../context/language-context";
import { Card, CardContent } from "./ui/card";
import { Avatar, AvatarFallback } from "./ui/avatar";

interface PublicStaffMember {
  id: string;
  pilotId?: number | null;
  username?: string | null;
  handle?: string | null;
  name: string;
  role: string;
  rank?: string | null;
  division: string;
  color: string;
  bio?: string;
  order?: number;
}

export function StaffTeam() {
  const { language } = useLanguage();
  const [staff, setStaff] = useState<PublicStaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const tr = (ru: string, en: string) => (language === "ru" ? ru : en);

  useEffect(() => {
    let active = true;

    const loadStaff = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/public/staff");
        const payload = response.ok ? await response.json().catch(() => null) : null;
        if (!active) {
          return;
        }
        setStaff(Array.isArray(payload?.staff) ? payload.staff : []);
      } catch {
        if (active) {
          setStaff([]);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadStaff();

    return () => {
      active = false;
    };
  }, []);

  const groupedStaff = useMemo(() => {
    const groups = new Map<string, PublicStaffMember[]>();
    staff.forEach((member) => {
      const key = String(member.division || tr("Общее", "General")).trim() || tr("Общее", "General");
      const current = groups.get(key) || [];
      current.push(member);
      groups.set(key, current);
    });

    return Array.from(groups.entries()).map(([division, members]) => ({
      division,
      members: members.sort((left, right) => {
        const orderDiff = Number(left.order || 0) - Number(right.order || 0);
        if (orderDiff !== 0) {
          return orderDiff;
        }
        return String(left.name || "").localeCompare(String(right.name || ""));
      }),
    }));
  }, [staff, tr]);

  return (
    <div className="bg-white">
      <section className="border-b border-gray-200 bg-[radial-gradient(circle_at_top_left,_rgba(227,30,36,0.16),_transparent_38%),linear-gradient(180deg,_#ffffff_0%,_#f8f8fa_100%)] py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-600">
              <ShieldCheck className="h-3.5 w-3.5" />
              {tr("Команда Nordwind Virtual", "Nordwind Virtual Team")}
            </div>
            <h1 className="mt-6 text-4xl font-bold tracking-tight text-[#111827] sm:text-5xl">
              {tr("Стафф и руководители виртуальной авиакомпании", "Staff and leadership behind the virtual airline")}
            </h1>
            <p className="mt-4 text-lg leading-8 text-gray-600">
              {tr(
                "Здесь собраны действующие руководители, менеджеры направлений и команда, которая поддерживает полеты, контент и сообщество.",
                "Meet the active leads, department owners, and community staff who keep operations, content, and support moving."
              )}
            </p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          {isLoading ? <div className="text-sm text-gray-500">{tr("Загрузка команды...", "Loading team...")}</div> : null}
          {!isLoading && groupedStaff.length === 0 ? <div className="text-sm text-gray-500">{tr("Список команды пока пуст.", "Team roster is empty right now.")}</div> : null}

          <div className="space-y-12">
            {groupedStaff.map((group) => (
              <div key={group.division} className="space-y-5">
                <div className="flex items-center gap-3">
                  <div className="h-px flex-1 bg-gray-200" />
                  <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-gray-400">{group.division}</h2>
                  <div className="h-px flex-1 bg-gray-200" />
                </div>
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {group.members.map((member) => (
                    <Card key={member.id} className="overflow-hidden border border-gray-200 shadow-sm">
                      <CardContent className="p-0">
                        <div className="h-1.5 w-full" style={{ backgroundColor: member.color || "#E31E24" }} />
                        <div className="space-y-4 p-6">
                          <div className="flex items-start gap-4">
                            <Avatar className="h-14 w-14 border border-gray-200">
                              <AvatarFallback style={{ backgroundColor: member.color || "#E31E24" }} className="font-semibold text-white">
                                {String(member.name || "S")
                                  .split(/\s+/)
                                  .filter(Boolean)
                                  .slice(0, 2)
                                  .map((part) => part.charAt(0))
                                  .join("")
                                  .toUpperCase() || "ST"}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <div className="text-xl font-semibold text-[#111827]">{member.name}</div>
                              <div className="mt-1 text-sm font-medium" style={{ color: member.color || "#E31E24" }}>{member.role}</div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                {member.handle ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1">
                                    <AtSign className="h-3 w-3" />
                                    {member.handle}
                                  </span>
                                ) : null}
                                {member.rank ? <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1">{member.rank}</span> : null}
                              </div>
                            </div>
                          </div>
                          {member.bio ? <p className="text-sm leading-6 text-gray-600">{member.bio}</p> : null}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}