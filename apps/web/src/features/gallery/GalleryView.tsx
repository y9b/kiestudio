import { Images, Search, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/motion/button";
import { InfiniteMasonry } from "@/components/motion/infinite-masonry";
import { Input } from "@/components/motion/input";
import { Loader } from "@/components/motion/loader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { isPending, type Generation } from "@/lib/api";
import { useT, type MessageKey } from "@/i18n";
import { modeInfo } from "@/lib/modes";
import { useAppState } from "@/state/app-state";
import { useGenerations } from "@/state/queries";
import { DetailModal } from "./DetailModal";
import { GenerationCard } from "./GenerationCard";

type Filter = "all" | "image" | "video" | "running" | "failed";

const FILTERS: { id: Filter; label: MessageKey }[] = [
  { id: "all", label: "gallery.all" },
  { id: "image", label: "gallery.images" },
  { id: "video", label: "gallery.videos" },
  { id: "running", label: "gallery.running" },
  { id: "failed", label: "gallery.failed" },
];

function matches(g: Generation, filter: Filter) {
  switch (filter) {
    case "image":
      return modeInfo(g.mode).output === "image" && g.status === "success";
    case "video":
      return modeInfo(g.mode).output === "video" && g.status === "success";
    case "running":
      return isPending(g.status);
    case "failed":
      return g.status === "fail";
    default:
      return true;
  }
}

export function GalleryView() {
  const { data, isLoading } = useGenerations();
  const { setView } = useAppState();
  const t = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [modelFilter, setModelFilter] = useState("all");

  // Models that appear in the history, most used first.
  const modelOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const g of data ?? []) counts.set(g.model, (counts.get(g.model) ?? 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [data]);
  const [openId, setOpenId] = useState<string | null>(null);

  const items = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter(
      (g) =>
        matches(g, filter) &&
        (modelFilter === "all" || g.model === modelFilter) &&
        (!q || g.prompt.toLowerCase().includes(q) || g.model.toLowerCase().includes(q)),
    );
  }, [data, filter, query, modelFilter]);

  const open = data?.find((g) => g.id === openId) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8 md:py-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Images className="size-6 text-foreground/80" strokeWidth={1.75} /> {t("gallery.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {data
              ? data.length === 1
                ? t("gallery.countOne")
                : t("gallery.count", { count: data.length })
              : t("gallery.loading")}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row md:w-auto">
          <div className="sm:w-60">
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger>
                <SelectValue placeholder={t("gallery.filterModel")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("gallery.allModels")}</SelectItem>
                {modelOptions.map(([model, count]) => (
                  <SelectItem key={model} value={model}>
                    {`${model} (${count})`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="sm:w-64">
          <Input
            value={query}
            onChange={setQuery}
            placeholder={t("gallery.search")}
            leftIcon={<Search className="size-4" />}
            aria-label={t("gallery.search")}
          />
          </div>
        </div>
      </header>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)} variant="pill">
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.id} value={f.id}>
              {t(f.label)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="flex justify-center py-24">
          <Loader variant="dots" size={32} />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-dashed border-border py-20 text-center">
          <div className="flex size-14 items-center justify-center text-muted-foreground">
            <Sparkles className="size-7" />
          </div>
          <div>
            <p className="font-medium">{data?.length ? t("gallery.emptyFilter") : t("gallery.empty")}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {data?.length ? t("gallery.emptyFilterDesc") : t("gallery.emptyDesc")}
            </p>
          </div>
          {!data?.length && <Button onClick={() => setView("studio")}>{t("gallery.goStudio")}</Button>}
        </div>
      ) : (
        <InfiniteMasonry
          items={items}
          getItemKey={(g) => g.id}
          renderItem={(g) => <GenerationCard gen={g} onOpen={() => setOpenId(g.id)} />}
          estimateSize={(g) => (modeInfo(g.mode).output === "video" ? 240 : 320)}
          onLoadMore={() => {}}
          hasMore={false}
          minColumnWidth={240}
          maxColumns={5}
          gap={16}
          ariaLabel={t("gallery.title")}
        />
      )}

      <DetailModal gen={open} onClose={() => setOpenId(null)} />
    </div>
  );
}
