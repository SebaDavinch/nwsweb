import { Link } from "react-router";
import { Plane, Users, Globe, Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Card, CardContent } from "./ui/card";
import { useLanguage } from "../context/language-context";
import { LiveFlightsWidget } from "./live-flights-widget";
import galleryImg1 from "@/assets/5399b1ff6c2f0f60fae26334dfbbcd6d43360dfb.png";
import galleryImg2 from "@/assets/adb05c43b73dc08fc1b4b481360d4c324c56de2c.png";
import galleryImg3 from "@/assets/e32c89aaade0d583e6bedee50681f610342d9a76.png";
import galleryImg4 from "@/assets/26e15098031469524c864ad646ad94972bd0af05.png";
import galleryImg5 from "@/assets/918b78e77231a5b76fcbed9da5749ce9227bc6ca.png";

export function Home() {
  const { t, language } = useLanguage();

  const [summary, setSummary] = useState<{
    pilots?: number | null;
    pirepsTotal?: number | null;
    aircraftTotal?: number | null;
    flightHours?: number | null;
  } | null>(null);

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const response = await fetch("/api/vamsys/summary", {
          credentials: "include",
        });
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        setSummary(payload || null);
      } catch {
        setSummary(null);
      }
    };

    loadSummary();
  }, []);

  const formatValue = (value: number | null | undefined, suffix = "") => {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
      return "—";
    }
    return `${Number(value).toLocaleString()}${suffix}`;
  };

  const getPilotsLabel = (value: number | null | undefined) => {
    const numeric = Number(value);
    if (language !== "ru" || !Number.isFinite(numeric)) {
      return t("home.stats.pilots");
    }

    const abs = Math.abs(Math.trunc(numeric));
    const mod10 = abs % 10;
    const mod100 = abs % 100;

    if (mod10 === 1 && mod100 !== 11) {
      return "Пилот";
    }
    if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) {
      return "Пилота";
    }
    return "Пилотов";
  };

  const stats = [
    { icon: Users, label: getPilotsLabel(summary?.pilots), value: formatValue(summary?.pilots) },
    { icon: Plane, label: t("home.stats.flights"), value: formatValue(summary?.pirepsTotal) },
    { icon: Globe, label: t("home.stats.destinations"), value: formatValue(summary?.aircraftTotal) },
    { icon: Clock, label: t("home.stats.hours"), value: formatValue(summary?.flightHours, "h") },
  ];

  const features = [
    {
      title: t("home.why.feature1.title"),
      description: t("home.why.feature1.desc"),
    },
    {
      title: t("home.why.feature2.title"),
      description: t("home.why.feature2.desc"),
    },
    {
      title: t("home.why.feature3.title"),
      description: t("home.why.feature3.desc"),
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section
        className="relative h-[600px] flex items-center justify-center text-white"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.5), rgba(0, 0, 0, 0.5)), url('https://images.unsplash.com/photo-1663007714483-2fe4742a6a3c?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhaXJwbGFuZSUyMHdpbmclMjBjbG91ZHMlMjBza3l8ZW58MXx8fHwxNzcxMTA2NjE4fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl mb-6">
            {t("home.hero.title")}{" "}
            <span className="text-[#E31E24]">Nordwind Virtual</span>
          </h1>
          <p className="text-xl md:text-2xl mb-8 text-gray-200">
            {t("home.hero.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link to="/join">
              <Button className="bg-[#E31E24] hover:bg-[#C11A20] text-white px-8 py-3 text-lg w-full sm:w-auto">
                {t("home.hero.join")}
              </Button>
            </Link>
            <Link to="/about">
              <Button
                variant="outline"
                className="bg-white/10 border-white text-white hover:bg-white/20 px-8 py-3 text-lg w-full sm:w-auto"
              >
                {t("home.hero.learn")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => {
              const Icon = stat.icon;
              return (
                <div key={index} className="text-center">
                  <div className="inline-flex items-center justify-center w-16 h-16 bg-[#E31E24] rounded-full mb-4">
                    <Icon className="text-white" size={32} />
                  </div>
                  <div className="text-3xl mb-2">{stat.value}</div>
                  <div className="text-gray-600">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl text-center mb-12">
            {t("home.why.title")} <span className="text-[#E31E24]">Nordwind Virtual</span>?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="border-gray-200">
                <CardContent className="p-6">
                  <h3 className="text-xl mb-3">{feature.title}</h3>
                  <p className="text-gray-600">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Live Flights Widget */}
      <LiveFlightsWidget />

      {/* Gallery Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl text-center mb-12">
            {t("home.gallery.title")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <img src={galleryImg1} alt="Nordwind Boeing 737" className="w-full h-64 object-cover" />
            </div>
            <div className="overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <img src={galleryImg2} alt="Nordwind Tail" className="w-full h-64 object-cover" />
            </div>
            <div className="overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <img src={galleryImg3} alt="Nordwind Boeing 737 in Flight" className="w-full h-64 object-cover" />
            </div>
            <div className="overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-shadow lg:col-span-2">
              <img src={galleryImg4} alt="Nordwind A321 Sunset" className="w-full h-64 object-cover" />
            </div>
            <div className="overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-shadow">
              <img src={galleryImg5} alt="Nordwind Silhouette" className="w-full h-64 object-cover" />
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-100 py-12 border-t border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                <div className="flex-1">
                    <h2 className="text-3xl font-bold mb-4 text-[#2A2A2A]">
                        {t("home.discord.title") || "Join our Community"}
                    </h2>
                    <p className="text-gray-600 mb-6 text-lg">
                        {t("home.discord.subtitle") || "Connect with other pilots, share your experiences, and get support in our active Discord server."}
                    </p>
                    <a 
                        href="https://discord.gg/nordwind" 
                        target="_blank" 
                        rel="noreferrer"
                        className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-[#5865F2] hover:bg-[#4752c4] transition-colors"
                    >
                        <Users className="w-5 h-5 mr-2" />
                        Join Discord Server
                    </a>
                </div>
                <div className="w-full md:w-[400px]">
                    <iframe 
                        src="https://discord.com/widget?id=YOUR_SERVER_ID&theme=light" 
                        width="100%" 
                        height="300" 
                        allowTransparency={true} 
                        sandbox="allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
                        className="rounded-xl shadow-lg border-0 bg-white"
                        title="Nordwind Virtual Discord"
                    />
                     <p className="text-xs text-center text-gray-400 mt-2">
                        Замените <code>YOUR_SERVER_ID</code> в коде на ID вашего сервера
                    </p>
                </div>
            </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section
        className="py-20 text-white"
        style={{
          backgroundImage: `linear-gradient(rgba(42, 42, 42, 0.9), rgba(42, 42, 42, 0.9)), url('https://images.unsplash.com/photo-1698073176073-2259484c87b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhaXJwbGFuZSUyMGNvY2twaXQlMjBwaWxvdHxlbnwxfHx8fDE3NzExODg0MTF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl mb-6">
            {t("home.cta.title")}
          </h2>
          <p className="text-xl mb-8 text-gray-200">
            {t("home.cta.subtitle")}
          </p>
          <Link to="/join">
            <Button className="bg-[#E31E24] hover:bg-[#C11A20] text-white px-8 py-6 text-lg">
              {t("home.cta.register")}
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}