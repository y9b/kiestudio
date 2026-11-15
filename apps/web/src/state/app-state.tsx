import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Generation, Mode } from "@/lib/api";
import { load, save } from "@/lib/storage";

export type View = "studio" | "gallery" | "settings";

/** What the studio form holds for one mode. */
export interface Draft {
  prompt: string;
  values: Record<string, unknown>;
}

interface AppState {
  view: View;
  setView: (v: View) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  modelByMode: Partial<Record<Mode, string>>;
  setModel: (mode: Mode, model: string) => void;
  drafts: Partial<Record<Mode, Draft>>;
  setDraft: (mode: Mode, draft: Draft) => void;
  /** Bump to tell the studio to re-seed the form (after "reuse settings"). */
  draftVersion: number;
  reuse: (g: Generation) => void;
}

const Ctx = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<View>(() => load<View>("view", "studio"));
  const [mode, setMode] = useState<Mode>(() => load<Mode>("mode", "t2i"));
  const [modelByMode, setModelByMode] = useState<Partial<Record<Mode, string>>>(() => load("models", {}));
  const [drafts, setDrafts] = useState<Partial<Record<Mode, Draft>>>({});
  const [draftVersion, setDraftVersion] = useState(0);

  useEffect(() => save("view", view), [view]);
  useEffect(() => save("mode", mode), [mode]);
  useEffect(() => save("models", modelByMode), [modelByMode]);

  const setModel = useCallback((m: Mode, model: string) => {
    setModelByMode((prev) => ({ ...prev, [m]: model }));
  }, []);

  const setDraft = useCallback((m: Mode, draft: Draft) => {
    setDrafts((prev) => ({ ...prev, [m]: draft }));
  }, []);

  const reuse = useCallback((g: Generation) => {
    const { prompt, ...values } = g.input;
    setMode(g.mode);
    setModelByMode((prev) => ({ ...prev, [g.mode]: g.model }));
    setDrafts((prev) => ({ ...prev, [g.mode]: { prompt: String(prompt ?? g.prompt ?? ""), values } }));
    setDraftVersion((v) => v + 1);
    setView("studio");
  }, []);

  const value = useMemo(
    () => ({ view, setView, mode, setMode, modelByMode, setModel, drafts, setDraft, draftVersion, reuse }),
    [view, mode, modelByMode, setModel, drafts, setDraft, draftVersion, reuse],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppState() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppState must be used inside AppStateProvider");
  return ctx;
}
