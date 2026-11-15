import { Info } from "lucide-react";
import { Tooltip } from "@/components/motion/tooltip";
import { useI18n, type Lang } from "@/i18n";
import type { ModelField } from "@/lib/api";

// Friendly names for common KIE parameters: [pt-BR, en, zh-CN].
const LABELS: Record<string, [string, string, string]> = {
  aspect_ratio: ["Proporção", "Aspect ratio", "宽高比"],
  resolution: ["Resolução", "Resolution", "分辨率"],
  duration: ["Duração (s)", "Duration (s)", "时长（秒）"],
  output_format: ["Formato", "Format", "格式"],
  negative_prompt: ["Prompt negativo", "Negative prompt", "反向提示词"],
  seed: ["Seed", "Seed", "随机种子"],
  sound: ["Som", "Sound", "声音"],
  generate_audio: ["Gerar áudio", "Generate audio", "生成音频"],
  quality: ["Qualidade", "Quality", "质量"],
  image_size: ["Tamanho", "Size", "尺寸"],
  num_images: ["Quantidade", "Count", "数量"],
  watermark: ["Marca d'água", "Watermark", "水印"],
  image_url: ["Imagem", "Image", "图片"],
  image_urls: ["Imagens", "Images", "图片"],
  image_input: ["Imagens de referência", "Reference images", "参考图片"],
  input_urls: ["Imagens de entrada", "Input images", "输入图片"],
  first_frame_url: ["Primeiro quadro", "First frame", "首帧"],
  last_frame_url: ["Último quadro", "Last frame", "尾帧"],
  first_clip_url: ["Clipe inicial", "First clip", "起始片段"],
  driving_audio_url: ["Áudio guia", "Driving audio", "驱动音频"],
  reference_image_urls: ["Imagens de referência", "Reference images", "参考图片"],
  reference_video_urls: ["Vídeos de referência", "Reference videos", "参考视频"],
  reference_audio_urls: ["Áudios de referência", "Reference audio", "参考音频"],
  mode: ["Modo", "Mode", "模式"],
  model: ["Variante", "Variant", "版本"],
  style: ["Estilo", "Style", "风格"],
  background: ["Fundo", "Background", "背景"],
  cfg_scale: ["CFG", "CFG", "CFG"],
  guidance_scale: ["Guidance", "Guidance", "引导强度"],
  enable_translation: ["Traduzir prompt", "Translate prompt", "翻译提示词"],
  enable_fallback: ["Usar fallback", "Enable fallback", "启用备用"],
  prompt_extend: ["Melhorar prompt", "Enhance prompt", "扩写提示词"],
  nsfw_checker: ["Filtro NSFW", "NSFW filter", "NSFW 过滤"],
  generation_type: ["Tipo de geração", "Generation type", "生成类型"],
  return_last_frame: ["Retornar último quadro", "Return last frame", "返回尾帧"],
  web_search: ["Busca na web", "Web search", "联网搜索"],
};

const IDX: Record<Lang, number> = { "pt-BR": 0, en: 1, "zh-CN": 2 };

export function fieldLabelFor(field: ModelField, lang: Lang) {
  return LABELS[field.name]?.[IDX[lang]] ?? field.label;
}

export function useFieldLabel() {
  const { lang } = useI18n();
  return (field: ModelField) => fieldLabelFor(field, lang);
}

export function FieldLabel({ field, hint }: { field: ModelField; hint?: string }) {
  const { t } = useI18n();
  const label = useFieldLabel()(field);
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
      <span className="text-foreground/90">{label}</span>
      {field.required && <span className="text-primary">*</span>}
      {hint && <span className="text-muted-foreground/70">({hint})</span>}
      {field.description && (
        <Tooltip content={<span className="block max-w-72 text-xs leading-relaxed">{field.description}</span>} side="top">
          <button
            type="button"
            aria-label={t("field.about", { name: label })}
            className="text-muted-foreground/70 hover:text-foreground"
          >
            <Info className="size-3.5" />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
