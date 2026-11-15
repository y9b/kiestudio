import { createContext, useContext, type ReactNode } from "react";
import { useT } from "@/i18n";
import {
  AnimatedToastStack,
  useAnimatedToastStack,
  type ToastInput,
} from "@/components/motion/animated-toast-stack";

type ShowToast = (toast: ToastInput) => string;

const Ctx = createContext<ShowToast | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { toasts, showToast, dismissToast } = useAnimatedToastStack({ defaultDuration: 4500, limit: 5 });
  const t = useT();
  return (
    <Ctx.Provider value={showToast as ShowToast}>
      {children}
      <AnimatedToastStack
        toasts={toasts}
        onDismiss={dismissToast}
        position="bottom-right"
        placement="fixed"
        labels={{ dismiss: t("toast.dismiss") }}
      />
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
