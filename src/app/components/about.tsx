import { Target, Heart, Award, Users } from "lucide-react";
import { Card, CardContent } from "./ui/card";
import { useLanguage } from "../context/language-context";

export function About() {
  const { t } = useLanguage();

  const values = [
    {
      icon: Heart,
      title: t("about.value1.title"),
      description: t("about.value1.desc"),
    },
    {
      icon: Users,
      title: t("about.value2.title"),
      description: t("about.value2.desc"),
    },
    {
      icon: Award,
      title: t("about.value3.title"),
      description: t("about.value3.desc"),
    },
    {
      icon: Target,
      title: t("about.value4.title"),
      description: t("about.value4.desc"),
    },
  ];

  return (
    <div>
      {/* Hero Section */}
      <section
        className="relative h-[400px] flex items-center justify-center text-white"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('https://images.unsplash.com/photo-1758669246636-17a5f6d972ec?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhaXJwb3J0JTIwdGVybWluYWwlMjBtb2Rlcm58ZW58MXx8fHwxNzcxMTM2NDM2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl mb-4">{t("about.hero.title")}</h1>
          <p className="text-xl text-gray-200">{t("about.hero.subtitle")}</p>
        </div>
      </section>

      {/* About Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="prose max-w-none">
            <h2 className="text-3xl mb-6">
              {t("about.welcome.title")}{" "}
              <span className="text-[#E31E24]">Nordwind Virtual</span>
            </h2>
            <p className="text-lg text-gray-700 mb-6">
              {t("about.welcome.p1")}
            </p>
            <p className="text-lg text-gray-700 mb-6">
              {t("about.welcome.p2")}
            </p>
            <p className="text-lg text-gray-700 mb-6">
              {t("about.welcome.p3")}
            </p>
            
            {/* Airlines Section */}
            <div className="bg-gray-50 rounded-lg p-6 mb-8">
              <h3 className="text-2xl mb-4 text-[#E31E24]">
                {t("about.airlines.title")}
              </h3>
              <p className="text-lg text-gray-700 mb-4">
                {t("about.airlines.desc")}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded p-4 text-center">
                  <div className="text-xl mb-1">Nordwind Airlines</div>
                  <div className="text-[#E31E24] text-sm">NWS</div>
                </div>
                <div className="bg-white rounded p-4 text-center">
                  <div className="text-xl mb-1">IKAR</div>
                  <div className="text-[#E31E24] text-sm">KAR</div>
                </div>
                <div className="bg-white rounded p-4 text-center">
                  <div className="text-xl mb-1">Southwind</div>
                  <div className="text-[#E31E24] text-sm">STW</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl text-center mb-12">{t("about.values.title")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <Card key={index} className="text-center">
                  <CardContent className="p-6">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-[#E31E24] rounded-full mb-4">
                      <Icon className="text-white" size={28} />
                    </div>
                    <h3 className="text-xl mb-3">{value.title}</h3>
                    <p className="text-gray-600">{value.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Platform Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl mb-6">{t("about.platform.title")}</h2>
          <p className="text-lg text-gray-700 mb-8">
            {t("about.platform.desc")}
          </p>
          <div className="bg-gray-50 rounded-lg p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
              <div>
                <h3 className="text-xl mb-2 text-[#E31E24]">
                  {t("about.platform.feature1.title")}
                </h3>
                <p className="text-gray-600">
                  {t("about.platform.feature1.desc")}
                </p>
              </div>
              <div>
                <h3 className="text-xl mb-2 text-[#E31E24]">
                  {t("about.platform.feature2.title")}
                </h3>
                <p className="text-gray-600">
                  {t("about.platform.feature2.desc")}
                </p>
              </div>
              <div>
                <h3 className="text-xl mb-2 text-[#E31E24]">
                  {t("about.platform.feature3.title")}
                </h3>
                <p className="text-gray-600">
                  {t("about.platform.feature3.desc")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}