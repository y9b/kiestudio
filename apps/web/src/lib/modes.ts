import { Clapperboard, Film, ImagePlus, Sparkles, type LucideIcon } from "lucide-react";
import type { MessageKey } from "@/i18n";
import type { Mode } from "./api";

export interface ModeInfo {
  id: Mode;
  icon: LucideIcon;
  output: "image" | "video";
  /** i18n keys: mode.<id>.label / short / description / placeholder */
  key: (part: "label" | "short" | "description" | "placeholder") => MessageKey;
}

const make = (id: Mode, icon: LucideIcon, output: ModeInfo["output"]): ModeInfo => ({
  id,
  icon,
  output,
  key: (part) => `mode.${id}.${part}` as MessageKey,
});

export const MODES: ModeInfo[] = [
  make("t2i", Sparkles, "image"),
  make("i2i", ImagePlus, "image"),
  make("t2v", Clapperboard, "video"),
  make("i2v", Film, "video"),
];

export const modeInfo = (id: Mode) => MODES.find((m) => m.id === id)!;

/** Sensible starting models per mode (used only if present in the catalog). */
export const PREFERRED_MODELS: Record<Mode, string[]> = {
  t2i: ["nano-banana-2", "gpt-image-2-text-to-image", "seedream/5-5-text-to-image", "google/imagen4-fast"],
  i2i: ["nano-banana-2", "gpt-image-2-image-to-image", "seedream/5-5-image-to-image", "google/nano-banana-edit"],
  t2v: ["kling-2.6/text-to-video", "bytedance/seedance-2-fast", "veo-3-1", "grok-imagine/text-to-video"],
  i2v: ["kling-2.6/image-to-video", "bytedance/seedance-2-fast", "veo-3-1", "grok-imagine/image-to-video"],
};

export function isVideoUrl(url: string) {
  return /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url);
}
