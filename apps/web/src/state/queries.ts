import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { api, isPending, type Generation, type Mode } from "@/lib/api";
import { useT } from "@/i18n";
import { useAppState } from "./app-state";
import { useToast } from "./toasts";

export function useSettings() {
  return useQuery({ queryKey: ["settings"], queryFn: api.settings, staleTime: 60_000 });
}

export function useCredits(enabled: boolean) {
  return useQuery({
    queryKey: ["credits"],
    queryFn: api.credits,
    enabled,
    staleTime: 30_000,
    refetchInterval: 120_000,
    retry: false,
  });
}

export function useModels(mode: Mode, enabled: boolean) {
  return useQuery({
    queryKey: ["models", mode],
    queryFn: () => api.models(mode),
    enabled,
    staleTime: 30 * 60_000,
    retry: 1,
  });
}

export function useSpec(model: string | undefined) {
  return useQuery({
    queryKey: ["spec", model],
    queryFn: () => api.spec(model!),
    enabled: Boolean(model),
    staleTime: Infinity,
    retry: 1,
  });
}

export function useGenerations() {
  return useQuery({
    queryKey: ["generations"],
    queryFn: api.generations,
    // Poll quickly while something is running, slowly otherwise.
    refetchInterval: (q) => (q.state.data?.some((g) => isPending(g.status)) ? 2500 : 20_000),
  });
}

export function useGenerate() {
  const qc = useQueryClient();
  const toast = useToast();
  const t = useT();
  return useMutation({
    mutationFn: api.generate,
    onSuccess: (gen) => {
      qc.setQueryData<Generation[]>(["generations"], (prev) => [gen, ...(prev ?? [])]);
      toast({ title: t("toast.sent"), description: t("toast.sentDesc"), status: "info" });
    },
    onError: (err: Error) => {
      toast({ title: t("toast.failedSend"), description: err.message, status: "error", duration: 8000 });
    },
  });
}

export function useDeleteGeneration() {
  const qc = useQueryClient();
  const toast = useToast();
  const t = useT();
  return useMutation({
    mutationFn: api.remove,
    onSuccess: (_, id) => {
      qc.setQueryData<Generation[]>(["generations"], (prev) => prev?.filter((g) => g.id !== id));
      toast({ title: t("toast.removed"), status: "neutral" });
    },
    onError: (err: Error) => toast({ title: t("toast.removeError"), description: err.message, status: "error" }),
  });
}

/** Shows a toast when a running generation finishes. */
export function useCompletionToasts() {
  const { data } = useGenerations();
  const toast = useToast();
  const t = useT();
  const qc = useQueryClient();
  const { setView } = useAppState();
  const prev = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    if (!data) return;
    const before = prev.current;
    prev.current = new Map(data.map((g) => [g.id, g.status]));
    if (!before) return;
    for (const g of data) {
      const was = before.get(g.id);
      if (!was || !isPending(was as Generation["status"]) || isPending(g.status)) continue;
      if (g.status === "success") {
        void qc.invalidateQueries({ queryKey: ["credits"] });
        toast({
          title: t("toast.done"),
          description: g.prompt ? `“${g.prompt.slice(0, 60)}${g.prompt.length > 60 ? "…" : ""}”` : g.model,
          status: "success",
          action: { label: t("toast.see"), onClick: () => setView("gallery") },
        });
      } else {
        toast({ title: t("toast.failed"), description: g.error ?? g.model, status: "error", duration: 9000 });
      }
    }
  }, [data, toast, qc, setView, t]);
}
