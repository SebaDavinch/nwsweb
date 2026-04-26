import { Card, CardContent } from "./ui/card";
import { CheckCircle, User, Plane, Download } from "lucide-react";
import { Button } from "./ui/button";
import { useLanguage } from "../context/language-context";

export function Join() {
  const { t } = useLanguage();

  const requirements = [
    t("join.req1"),
    t("join.req2"),
    t("join.req3"),
    t("join.req4"),
  ];

  const steps = [
    {
      icon: User,
      title: t("join.step1.title"),
      description: t("join.step1.desc"),
    },
    {
      icon: Download,
      title: t("join.step2.title"),
      description: t("join.step2.desc"),
    },
    {
      icon: Plane,
      title: t("join.step3.title"),
      description: t("join.step3.desc"),
    },
  ];

  const benefits = [
    t("join.benefit1"),
    t("join.benefit2"),
    t("join.benefit3"),
    t("join.benefit4"),
    t("join.benefit5"),
    t("join.benefit6"),
  ];

  return (
    <div>
      {/* Hero Section */}
      <section
        className="relative h-[400px] flex items-center justify-center text-white"
        style={{
          backgroundImage: `linear-gradient(rgba(0, 0, 0, 0.6), rgba(0, 0, 0, 0.6)), url('https://images.unsplash.com/photo-1698073176073-2259484c87b4?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhaXJwbGFuZSUyMGNvY2twaXQlMjBwaWxvdHxlbnwxfHx8fDE3NzExODg0MTF8MA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral')`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl mb-4">{t("join.hero.title")}</h1>
          <p className="text-xl text-gray-200">{t("join.hero.subtitle")}</p>
        </div>
      </section>

      {/* Requirements */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl mb-8 text-center">{t("join.requirements.title")}</h2>
          <Card>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {requirements.map((req, index) => (
                  <div key={index} className="flex items-start space-x-3">
                    <CheckCircle className="text-[#E31E24] flex-shrink-0 mt-1" size={20} />
                    <span className="text-gray-700">{req}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Steps */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl mb-12 text-center">{t("join.steps.title")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <Card key={index} className="text-center">
                  <CardContent className="p-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-[#E31E24] rounded-full mb-6">
                      <Icon className="text-white" size={36} />
                    </div>
                    <div className="text-4xl text-[#E31E24] mb-4">{index + 1}</div>
                    <h3 className="text-xl mb-3">{step.title}</h3>
                    <p className="text-gray-600">{step.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl mb-8 text-center">{t("join.benefits.title")}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {benefits.map((benefit, index) => (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="text-[#E31E24] flex-shrink-0 mt-1" size={24} />
                    <span className="text-lg">{benefit}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-[#E31E24] text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl mb-6">{t("join.cta.title")}</h2>
          <p className="text-xl mb-8">
            {t("join.cta.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              className="bg-white text-[#E31E24] hover:bg-gray-100 px-8 py-6 text-lg"
              onClick={() => {
                window.open("https://vamsys.io/register/nws", "_blank");
              }}
            >
              {t("join.cta.button")}
            </Button>
            <Button
              className="bg-white text-[#E31E24] hover:bg-gray-100 px-8 py-6 text-lg"
              onClick={() => {
                window.open("https://vamsys.io/register/rag", "_blank");
              }}
            >
              {t("join.cta.ragButton")}
            </Button>
          </div>
          <p className="text-sm mt-4 text-gray-100">
            {t("join.cta.note")}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl mb-8 text-center">{t("join.faq.title")}</h2>
          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl mb-2">{t("join.faq1.q")}</h3>
                <p className="text-gray-600">
                  {t("join.faq1.a")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl mb-2">{t("join.faq2.q")}</h3>
                <p className="text-gray-600">
                  {t("join.faq2.a")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl mb-2">{t("join.faq3.q")}</h3>
                <p className="text-gray-600">
                  {t("join.faq3.a")}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl mb-2">{t("join.faq4.q")}</h3>
                <p className="text-gray-600">
                  {t("join.faq4.a")}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}