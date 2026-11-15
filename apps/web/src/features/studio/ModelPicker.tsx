import { Star } from "lucide-react";
import { useMemo } from "react";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxGroup,
  ComboboxInput,
  ComboboxItem,
  ComboboxLabel,
  ComboboxList,
  ComboboxSeparator,
  ComboboxTrigger,
} from "@/components/motion/combobox";
import type { CatalogModel, Mode } from "@/lib/api";
import { useT } from "@/i18n";
import { PREFERRED_MODELS } from "@/lib/modes";

/** "Affordable Kling 2.1 Master API — Premium…" → "Kling 2.1 Master" */
export function shortTitle(m: CatalogModel) {
  const t = (m.title || m.model)
    .split(/\s+[—–|-]\s+/)[0]!
    .replace(/^(Affordable|Cheap|Fast|Free)\s+/i, "")
    .replace(/\s+API$/i, "")
    .trim();
  return t.length > 3 ? t : m.model;
}

/** First sentence of the pricing text, kept short for list rows. */
export function shortPrice(pricing: string | null) {
  if (!pricing) return "";
  const first = pricing.split(/\n|(?<=\.)\s/)[0]!.trim();
  return first.length > 90 ? `${first.slice(0, 88)}…` : first;
}

export function ModelPicker({
  mode,
  models,
  value,
  onChange,
}: {
  mode: Mode;
  models: CatalogModel[];
  value: string | undefined;
  onChange: (model: string) => void;
}) {
  const t = useT();
  const { featured, rest } = useMemo(() => {
    const pref = PREFERRED_MODELS[mode];
    const featured = pref.map((id) => models.find((m) => m.model === id)).filter(Boolean) as CatalogModel[];
    const rest = models
      .filter((m) => !pref.includes(m.model))
      .sort((a, b) => a.provider.localeCompare(b.provider) || shortTitle(a).localeCompare(shortTitle(b)));
    return { featured, rest };
  }, [mode, models]);

  const renderItem = (m: CatalogModel) => (
    <ComboboxItem
      key={m.model}
      value={m.model}
      textValue={shortTitle(m)}
      keywords={[m.model, m.provider]}
      className="py-2"
    >
      <span className="block min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate font-medium text-foreground">{shortTitle(m)}</span>
          <span className="shrink-0 rounded-md bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{m.provider}</span>
        </span>
        <span className="block truncate text-[11px] text-muted-foreground">{shortPrice(m.pricing) || m.model}</span>
      </span>
    </ComboboxItem>
  );

  return (
    <Combobox value={value} onValueChange={onChange}>
      <ComboboxTrigger className="h-11 rounded-xl px-2.5">
        <ComboboxInput aria-label={t("picker.searchLabel")} placeholder={t("picker.search")} />
      </ComboboxTrigger>
      <ComboboxContent className="w-[min(26rem,calc(100vw-2rem))] rounded-2xl">
        <ComboboxList ariaLabel={t("picker.models")} className="max-h-96 p-2">
          <ComboboxEmpty>{t("picker.empty")}</ComboboxEmpty>
          {featured.length > 0 && (
            <ComboboxGroup>
              <ComboboxLabel>
                <span className="flex items-center gap-1.5">
                  <Star className="size-3" /> {t("picker.recommended")}
                </span>
              </ComboboxLabel>
              {featured.map(renderItem)}
            </ComboboxGroup>
          )}
          {rest.length > 0 && (
            <ComboboxGroup>
              {featured.length > 0 && <ComboboxSeparator />}
              <ComboboxLabel>{t("picker.all", { count: rest.length })}</ComboboxLabel>
              {rest.map(renderItem)}
            </ComboboxGroup>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
