import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ExternalLink, FolderOpen, HardDrive, KeyRound, Palette, Settings as SettingsIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/motion/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/motion/card";
import { Input } from "@/components/motion/input";
import { Switch } from "@/components/motion/switch";
import { ThemeToggle } from "@/components/motion/theme-toggle";
import { LanguageSwitcher } from "@/features/layout/LanguageSwitcher";
import { useI18n } from "@/i18n";
import { api, type Settings } from "@/lib/api";
import { useCredits, useSettings } from "@/state/queries";
import { useToast } from "@/state/toasts";

function ApiKeyCard({ s }: { s: Settings | undefined }) {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const credits = useCredits(Boolean(s?.hasKey));
  const [key, setKey] = useState("");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  const save = async (value: string | null) => {
    setSaving(true);
    setError(undefined);
    try {
      const next = await api.saveApiKey(value);
      qc.setQueryData(["settings"], next);
      await qc.invalidateQueries({ queryKey: ["credits"] });
      await qc.invalidateQueries({ queryKey: ["models"] });
      setKey("");
      toast({
        title: value ? t("settings.keySaved") : t("settings.keyRemoved"),
        description: value ? t("settings.keySavedDesc") : undefined,
        status: "success",
      });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4" /> {t("settings.apiKey")}
        </CardTitle>
        <CardDescription>{t("settings.apiKeyDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {s?.hasKey && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span>
              {t("settings.connected", { key: s.maskedKey ?? "" })}
              <span className="text-muted-foreground">
                {" "}
                ({s.keySource === "env" ? t("settings.fromEnv") : t("settings.fromApp")})
              </span>
            </span>
            {credits.data && (
              <span className="ml-auto text-muted-foreground">
                {t("settings.balance", { credits: credits.data.credits.toLocaleString(lang) })}
              </span>
            )}
          </div>
        )}

        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-start"
          onSubmit={(e) => {
            e.preventDefault();
            if (key.trim()) void save(key.trim());
          }}
        >
          <div className="flex-1">
            <Input
              type="password"
              autoComplete="off"
              placeholder={s?.hasKey ? t("settings.newKey") : t("settings.pasteKey")}
              value={key}
              onChange={(v) => {
                setKey(v);
                setError(undefined);
              }}
              error={error}
              aria-label={t("settings.apiKey")}
            />
          </div>
          <Button type="submit" disabled={!key.trim() || saving}>
            {saving ? t("settings.checking") : t("settings.saveTest")}
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <a
            href="https://kie.ai/api-key"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-primary hover:underline"
          >
            {t("settings.getKey")} <ExternalLink className="size-3.5" />
          </a>
          {s?.keySource === "settings" && (
            <Button variant="ghost" size="sm" onClick={() => void save(null)} disabled={saving}>
              {t("settings.removeKey")}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function StorageCard({ s }: { s: Settings | undefined }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const toast = useToast();
  const storage = s?.storage;
  const [dir, setDir] = useState(storage?.mediaDir ?? "");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (storage) setDir(storage.mediaDir);
  }, [storage?.mediaDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (data: { downloadMedia?: boolean; mediaDir?: string | null }, quiet = false) => {
    setSaving(true);
    setError(undefined);
    try {
      const next = await api.saveStorage(data);
      qc.setQueryData(["settings"], next);
      if (!quiet) toast({ title: t("settings.storageSaved"), description: next.storage.mediaDir, status: "success" });
      else if (data.downloadMedia === false) toast({ title: t("settings.storageSaved"), description: t("settings.autoSaveOff"), status: "info" });
      else toast({ title: t("settings.storageSaved"), status: "success" });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!storage) return null;
  const dirty = dir.trim() !== storage.mediaDir;
  const isDefault = storage.mediaDir === storage.defaultMediaDir;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HardDrive className="size-4" /> {t("settings.storage")}
        </CardTitle>
        <CardDescription>{t("settings.storageDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{t("settings.autoSave")}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.autoSaveDesc")}</p>
          </div>
          <Switch
            checked={storage.downloadMedia}
            onCheckedChange={(v) => void save({ downloadMedia: v }, true)}
            disabled={saving}
            ariaLabel={t("settings.autoSave")}
          />
        </div>

        <div className={storage.downloadMedia ? "flex flex-col gap-2" : "pointer-events-none flex flex-col gap-2 opacity-50"}>
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium">
              <FolderOpen className="size-4 text-muted-foreground" /> {t("settings.folder")}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">{t("settings.folderDesc")}</p>
          </div>
          <form
            className="flex flex-col gap-2 sm:flex-row sm:items-start"
            onSubmit={(e) => {
              e.preventDefault();
              if (dirty && dir.trim()) void save({ mediaDir: dir.trim() });
            }}
          >
            <div className="min-w-0 flex-1">
              <Input
                value={dir}
                onChange={(v) => {
                  setDir(v);
                  setError(undefined);
                }}
                error={error}
                spellCheck={false}
                className="font-mono"
                aria-label={t("settings.folder")}
              />
            </div>
            <Button type="submit" disabled={!dirty || !dir.trim() || saving}>
              {t("settings.saveFolder")}
            </Button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted-foreground">
            <span className="break-all font-mono">{t("settings.default", { path: storage.defaultMediaDir })}</span>
            {!isDefault && (
              <Button variant="ghost" size="sm" onClick={() => void save({ mediaDir: null })} disabled={saving}>
                {t("settings.useDefault")}
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function SettingsView() {
  const { t } = useI18n();
  const settings = useSettings();
  const s = settings.data;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 md:px-8 md:py-10">
      <header>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <SettingsIcon className="size-6 text-primary" /> {t("settings.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("settings.subtitle")}</p>
      </header>

      <ApiKeyCard s={s} />
      <StorageCard s={s} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-4" /> {t("settings.appearance")}
          </CardTitle>
          <CardDescription>{t("settings.appearanceDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">{t("settings.theme")}</span>
            <ThemeToggle variant="circle-blur" className="size-10 rounded-xl border border-border" />
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">{t("settings.language")}</span>
            <LanguageSwitcher className="w-48" />
          </div>
        </CardContent>
      </Card>

      <Card variant="muted">
        <CardHeader>
          <CardTitle>{t("settings.where")}</CardTitle>
          <CardDescription>{t("settings.whereDesc")}</CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
