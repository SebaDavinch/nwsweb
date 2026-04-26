import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { ImageUp, Palette, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { emitSiteDesignUpdated, DEFAULT_SITE_DESIGN, type SiteDesignSettings } from "../../hooks/use-site-design";

interface SystemStatus {
  vamsys?: {
    configured?: boolean;
    reachable?: boolean;
  };
  discord?: {
    configured?: boolean;
    newsChannelIdSet?: boolean;
  };
  server?: {
    port?: number;
  };
}

export function AdminSettings() {
  const [status, setStatus] = useState<SystemStatus>({});
  const [design, setDesign] = useState<SiteDesignSettings>(DEFAULT_SITE_DESIGN);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadDesign = async () => {
    try {
      const response = await fetch("/api/admin/site-design", { credentials: "include" });
      const payload = response.ok ? await response.json() : null;
      setDesign({
        ...DEFAULT_SITE_DESIGN,
        ...(payload?.design && typeof payload.design === "object" ? payload.design : {}),
      });
    } catch (error) {
      console.error("Failed to load site design", error);
    }
  };

  useEffect(() => {
    let active = true;

    const loadStatus = async () => {
      try {
        const response = await fetch("/api/admin/system-status");
        if (!response.ok) {
          return;
        }
        const payload = await response.json();
        if (active) {
          setStatus(payload || {});
        }
      } catch (error) {
        console.error("Failed to load system status", error);
      }
    };

    loadStatus();
    loadDesign().catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  const healthBadge = (ok: boolean) => (
    <Badge
      variant="outline"
      className={ok ? "border-green-200 bg-green-50 text-green-700" : "border-red-200 bg-red-50 text-red-700"}
    >
      {ok ? "OK" : "Missing"}
    </Badge>
  );

  const previewLogo = useMemo(
    () => design.headerLogoDataUrl || design.loginLogoDataUrl || design.adminLogoDataUrl || design.footerLogoDataUrl,
    [design.adminLogoDataUrl, design.footerLogoDataUrl, design.headerLogoDataUrl, design.loginLogoDataUrl]
  );

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>, key: keyof Pick<SiteDesignSettings, "headerLogoDataUrl" | "footerLogoDataUrl" | "loginLogoDataUrl" | "adminLogoDataUrl">) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setDesign((current) => ({
        ...current,
        [key]: typeof reader.result === "string" ? reader.result : current[key],
      }));
    };
    reader.readAsDataURL(file);
  };

  const saveDesign = async () => {
    setIsSaving(true);
    try {
      const response = await fetch("/api/admin/site-design", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(design),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(String(payload?.error || "Failed to save site design"));
      }

      const nextDesign = {
        ...DEFAULT_SITE_DESIGN,
        ...(payload?.design && typeof payload.design === "object" ? payload.design : design),
      };
      setDesign(nextDesign);
      emitSiteDesignUpdated(nextDesign);
      toast.success("Site design saved");
    } catch (error) {
      console.error("Failed to save site design", error);
      toast.error(String(error || "Failed to save site design"));
    } finally {
      setIsSaving(false);
    }
  };

  const refreshSettings = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        fetch("/api/admin/system-status").then((response) => (response.ok ? response.json() : null)).then((payload) => {
          if (payload) {
            setStatus(payload || {});
          }
        }),
        loadDesign(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">System Settings</h2>
          <p className="text-sm text-gray-500">Environment health plus site branding controls</p>
        </div>
        <Button variant="outline" onClick={() => refreshSettings()} disabled={isRefreshing}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="border-none shadow-sm">
          <CardContent className="p-6">
            <div className="mb-5 flex items-center gap-3">
              <Palette className="h-5 w-5 text-gray-500" />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Site design</h3>
                <p className="text-sm text-gray-500">Manage the visible logos and brand colors for public and admin surfaces.</p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Site title</Label>
                  <Input value={design.siteTitle} onChange={(event) => setDesign((current) => ({ ...current, siteTitle: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Tagline</Label>
                  <Input value={design.tagline} onChange={(event) => setDesign((current) => ({ ...current, tagline: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Primary color</Label>
                  <Input type="color" value={design.primaryColor} onChange={(event) => setDesign((current) => ({ ...current, primaryColor: event.target.value }))} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label>Accent color</Label>
                  <Input type="color" value={design.accentColor} onChange={(event) => setDesign((current) => ({ ...current, accentColor: event.target.value }))} className="h-11" />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {([
                  ["headerLogoDataUrl", "Header logo"],
                  ["footerLogoDataUrl", "Footer logo"],
                  ["loginLogoDataUrl", "Login logo"],
                  ["adminLogoDataUrl", "Admin logo"],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-2 rounded-xl border border-gray-200 p-4">
                    <Label>{label}</Label>
                    <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-gray-300 px-4 py-6 text-sm text-gray-500 hover:border-gray-400 hover:bg-gray-50">
                      <ImageUp className="h-4 w-4" />
                      Upload image
                      <input type="file" accept="image/*" className="hidden" onChange={(event) => handleFileUpload(event, key)} />
                    </label>
                    <div className="rounded-lg bg-gray-50 p-3 text-center">
                      {design[key] ? <img src={design[key]} alt={label} className="mx-auto max-h-16 w-auto object-contain" /> : <span className="text-xs text-gray-400">Using default asset</span>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button onClick={saveDesign} disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  Save design
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="mb-5">
                <h3 className="text-lg font-semibold text-gray-900">Preview</h3>
                <p className="text-sm text-gray-500">Quick brand preview for logos and main palette.</p>
              </div>
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between px-5 py-4 text-white" style={{ backgroundColor: design.accentColor }}>
                  <div className="flex items-center gap-3">
                    {previewLogo ? <img src={previewLogo} alt={design.siteTitle} className="h-10 w-auto object-contain" /> : null}
                    <div>
                      <div className="font-semibold">{design.siteTitle}</div>
                      <div className="text-xs text-white/70">{design.tagline || "—"}</div>
                    </div>
                  </div>
                  <div className="rounded-full px-3 py-1 text-xs font-medium text-white" style={{ backgroundColor: design.primaryColor }}>Brand</div>
                </div>
                <div className="space-y-4 p-5">
                  <div className="h-2 rounded-full" style={{ backgroundColor: design.primaryColor }} />
                  <div className="flex gap-3">
                    <div className="rounded-lg px-4 py-2 text-white" style={{ backgroundColor: design.primaryColor }}>Primary</div>
                    <div className="rounded-lg border px-4 py-2" style={{ borderColor: design.primaryColor, color: design.primaryColor }}>Outline</div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardContent className="p-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="text-gray-700">vAMSYS credentials configured</span>
                  {healthBadge(Boolean(status.vamsys?.configured))}
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="text-gray-700">vAMSYS reachable</span>
                  {healthBadge(Boolean(status.vamsys?.reachable))}
                </div>
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <span className="text-gray-700">Discord publish configured</span>
                  {healthBadge(Boolean(status.discord?.configured))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Server port</span>
                  <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-700">
                    {status.server?.port || 8787}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
