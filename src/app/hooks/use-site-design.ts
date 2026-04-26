import { useEffect, useState } from "react";

export interface SiteDesignSettings {
  siteTitle: string;
  tagline: string;
  primaryColor: string;
  accentColor: string;
  headerLogoDataUrl: string;
  footerLogoDataUrl: string;
  loginLogoDataUrl: string;
  adminLogoDataUrl: string;
  updatedAt?: string | null;
}

export const DEFAULT_SITE_DESIGN: SiteDesignSettings = {
  siteTitle: "Nordwind Virtual",
  tagline: "nordwind virtual group",
  primaryColor: "#E31E24",
  accentColor: "#2A2A2A",
  headerLogoDataUrl: "",
  footerLogoDataUrl: "",
  loginLogoDataUrl: "",
  adminLogoDataUrl: "",
  updatedAt: null,
};

let cachedSiteDesign: SiteDesignSettings | null = null;

export const emitSiteDesignUpdated = (design: SiteDesignSettings) => {
  cachedSiteDesign = design;
  window.dispatchEvent(new CustomEvent<SiteDesignSettings>("site-design-updated", { detail: design }));
};

export function useSiteDesign() {
  const [design, setDesign] = useState<SiteDesignSettings>(cachedSiteDesign || DEFAULT_SITE_DESIGN);

  useEffect(() => {
    let active = true;

    const applyDesign = (value?: Partial<SiteDesignSettings> | null) => {
      const nextDesign = {
        ...DEFAULT_SITE_DESIGN,
        ...(value && typeof value === "object" ? value : {}),
      };
      cachedSiteDesign = nextDesign;
      if (active) {
        setDesign(nextDesign);
      }
    };

    const handleDesignEvent = (event: Event) => {
      const customEvent = event as CustomEvent<SiteDesignSettings>;
      applyDesign(customEvent.detail);
    };

    window.addEventListener("site-design-updated", handleDesignEvent);

    if (cachedSiteDesign) {
      applyDesign(cachedSiteDesign);
    } else {
      fetch("/api/site-design")
        .then((response) => (response.ok ? response.json() : null))
        .then((payload) => {
          applyDesign(payload?.design);
        })
        .catch(() => {
          applyDesign(DEFAULT_SITE_DESIGN);
        });
    }

    return () => {
      active = false;
      window.removeEventListener("site-design-updated", handleDesignEvent);
    };
  }, []);

  return design;
}