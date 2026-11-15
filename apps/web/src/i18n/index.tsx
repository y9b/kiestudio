import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { LocaleProvider } from "@/lib/i18n";
import { load, save } from "@/lib/storage";
import { BEUI_MESSAGES } from "./beui";
import { DICTIONARIES, type Lang, type MessageKey } from "./messages";

export type { Lang, MessageKey };
export { LANGUAGES } from "./messages";

type Vars = Record<string, string | number>;
export type T = (key: MessageKey, vars?: Vars) => string;

function format(template: string, vars?: Vars) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

function detectLang(): Lang {
  const nav = typeof navigator !== "undefined" ? navigator.language : "pt-BR";
  if (nav.startsWith("zh")) return "zh-CN";
  if (nav.startsWith("pt")) return "pt-BR";
  return "en";
}

// Current language for code that runs outside React (fetch helpers).
let currentLang: Lang = load<Lang>("lang", detectLang());
export const translate: T = (key, vars) => format(DICTIONARIES[currentLang][key] ?? key, vars);

interface I18n {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: T;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang);

  const setLang = useCallback((next: Lang) => {
    currentLang = next;
    save("lang", next);
    setLangState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo<I18n>(
    () => ({ lang, setLang, t: (key, vars) => format(DICTIONARIES[lang][key] ?? key, vars) }),
    [lang, setLang],
  );

  return (
    <Ctx.Provider value={value}>
      <LocaleProvider locale={lang} messages={BEUI_MESSAGES[lang]}>
        {children}
      </LocaleProvider>
    </Ctx.Provider>
  );
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}

export const useT = () => useI18n().t;
