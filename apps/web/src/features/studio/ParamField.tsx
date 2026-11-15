import { Input } from "@/components/motion/input";
import { RangeSlider } from "@/components/motion/range-slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select";
import { Switch } from "@/components/motion/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import type { ModelField } from "@/lib/api";
import { useT } from "@/i18n";
import { FieldLabel, useFieldLabel } from "./FieldLabel";

/** Short enums render as a segmented control; longer ones as a select. */
function isSegmented(options: (string | number)[]) {
  return options.length <= 4 && options.every((o) => String(o).length <= 9);
}

function optionLabel(o: string | number) {
  const s = String(o);
  if (s === "auto" || s === "Auto") return "Auto";
  return s;
}

export function ParamField({
  field,
  value,
  onChange,
}: {
  field: ModelField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const t = useT();
  const fieldLabel = useFieldLabel();
  switch (field.kind) {
    case "enum": {
      const options = field.options ?? [];
      // Option values may be numbers; the controls work with strings.
      const toValue = (s: string) => options.find((o) => String(o) === s) ?? s;
      const current = value === undefined || value === null ? "" : String(value);
      if (isSegmented(options)) {
        return (
          <div className="flex flex-col gap-2">
            <FieldLabel field={field} />
            <Tabs value={current} onValueChange={(v) => onChange(toValue(v))} variant="segment">
              <TabsList wrapperClassName="w-full" className="w-full">
                {options.map((o) => (
                  <TabsTrigger key={String(o)} value={String(o)} className="flex-1 text-xs">
                    {optionLabel(o)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-2">
          <FieldLabel field={field} />
          <Select value={current} onValueChange={(v) => onChange(toValue(v))}>
            <SelectTrigger>
              <SelectValue placeholder={t("field.choose")} />
            </SelectTrigger>
            <SelectContent>
              {options.map((o) => (
                <SelectItem key={String(o)} value={String(o)}>
                  {optionLabel(o)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    case "boolean":
      return (
        <div className="flex items-center justify-between gap-3 py-1">
          <FieldLabel field={field} />
          <Switch checked={Boolean(value)} onCheckedChange={onChange} ariaLabel={fieldLabel(field)} />
        </div>
      );

    case "number": {
      const { min, max, integer } = field;
      const num = typeof value === "number" ? value : value === "" || value == null ? undefined : Number(value);
      const sliderable = min !== undefined && max !== undefined && max - min <= 1000 && max > min;
      if (sliderable) {
        const step = integer ? 1 : max - min <= 2 ? 0.05 : max - min <= 20 ? 0.5 : 1;
        return (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <FieldLabel field={field} />
              <span className="text-xs font-semibold tabular-nums">{num ?? "—"}</span>
            </div>
            <RangeSlider
              value={num ?? min}
              onValueChange={onChange}
              min={min}
              max={max}
              step={step}
              showTicks={integer && max - min <= 20}
              aria-label={fieldLabel(field)}
            />
          </div>
        );
      }
      return (
        <div className="flex flex-col gap-2">
          <FieldLabel field={field} hint={min !== undefined && max !== undefined ? `${min}–${max}` : undefined} />
          <Input
            type="number"
            inputMode="numeric"
            value={num === undefined || Number.isNaN(num) ? "" : String(num)}
            onChange={(v) => onChange(v === "" ? undefined : integer ? Math.round(Number(v)) : Number(v))}
            min={min}
            max={max}
            placeholder={field.name === "seed" ? t("field.random") : undefined}
          />
        </div>
      );
    }

    case "list":
      return (
        <div className="flex flex-col gap-2">
          <FieldLabel field={field} hint={t("field.commaSeparated")} />
          <Input
            value={Array.isArray(value) ? value.join(", ") : ""}
            onChange={(v) =>
              onChange(
                v
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              )
            }
          />
        </div>
      );

    case "text":
    default:
      return (
        <div className="flex flex-col gap-2">
          <FieldLabel field={field} />
          <Input
            value={typeof value === "string" ? value : value == null ? "" : String(value)}
            onChange={onChange}
            maxLength={field.maxLength}
          />
        </div>
      );
  }
}
