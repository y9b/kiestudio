import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ApiKeyBanner } from "@/features/layout/ApiKeyBanner";
import { Sidebar } from "@/features/layout/Sidebar";
import { GalleryView } from "@/features/gallery/GalleryView";
import { SettingsView } from "@/features/settings/SettingsView";
import { StudioView } from "@/features/studio/StudioView";
import { useAppState } from "@/state/app-state";
import { useCompletionToasts } from "@/state/queries";

export function App() {
  const { view } = useAppState();
  const reduce = useReducedMotion();
  useCompletionToasts();

  return (
    <div className="flex min-h-dvh bg-background text-foreground">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
        <ApiKeyBanner />
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={view}
            className="flex min-h-0 flex-1 flex-col"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {view === "studio" && <StudioView />}
            {view === "gallery" && <GalleryView />}
            {view === "settings" && <SettingsView />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
