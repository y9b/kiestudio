import { useEffect, useRef, useState } from "react";
import { AttachmentUpload, type AttachmentUploadItem } from "@/components/motion/attachment-upload";
import { api, type ModelField } from "@/lib/api";
import { useT } from "@/i18n";
import { useToast } from "@/state/toasts";
import { FieldLabel } from "./FieldLabel";

type Item = AttachmentUploadItem & { remoteUrl?: string };

const ACCEPT: Record<NonNullable<ModelField["accept"]>, string> = {
  image: "image/png,image/jpeg,image/webp,image/gif",
  video: "video/mp4,video/quicktime,video/webm",
  audio: "audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/aac",
};

function urlsOf(value: unknown): string[] {
  if (typeof value === "string" && value) return [value];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === "string" && v.length > 0);
  return [];
}

function itemFromUrl(url: string, i: number, accept: ModelField["accept"]): Item {
  const name = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? `arquivo-${i + 1}`);
  return {
    id: `existing-${i}-${url}`,
    name,
    kind: accept === "image" ? "image" : accept === "audio" ? "audio" : "file",
    previewUrl: accept === "image" ? url : undefined,
    href: url,
    remoteUrl: url,
    status: "complete",
  };
}

/**
 * Uploads files to KIE's temporary storage (through our server) and stores the
 * resulting URLs as the field's value: a string for `file`, an array for `files`.
 */
export function FileField({
  field,
  value,
  onChange,
  onBusyChange,
}: {
  field: ModelField;
  value: unknown;
  onChange: (value: unknown) => void;
  onBusyChange: (name: string, busy: boolean) => void;
}) {
  const toast = useToast();
  const t = useT();
  const multiple = field.kind === "files";
  const max = multiple ? (field.maxItems ?? 10) : 1;
  const [items, setItems] = useState<Item[]>(() => urlsOf(value).map((u, i) => itemFromUrl(u, i, field.accept)));
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Publish the uploaded URLs and the busy state whenever items change.
  useEffect(() => {
    const urls = items.filter((it) => it.remoteUrl).map((it) => it.remoteUrl!);
    onChange(multiple ? urls : (urls[0] ?? ""));
    onBusyChange(field.name, items.some((it) => it.status === "uploading"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const patch = (id: string, next: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...next } : it)));

  const upload = async (item: Item) => {
    if (!item.file) return;
    patch(item.id, { status: "uploading", error: undefined });
    try {
      const { url } = await api.upload(item.file);
      patch(item.id, { status: "complete", remoteUrl: url });
    } catch (err) {
      patch(item.id, { status: "failed", error: (err as Error).message });
      toast({ title: t("field.uploadFailed", { name: item.name }), description: (err as Error).message, status: "error" });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <FieldLabel field={field} hint={multiple ? t("field.upTo", { max }) : undefined} />
      <AttachmentUpload
        value={items}
        onValueChange={(next) => setItems(next as Item[])}
        onFilesAdded={(added) => {
          // Single-file fields: a new file replaces the old one.
          // (itemsRef still holds the list from before this drop.)
          if (!multiple && itemsRef.current.length > 0) {
            setItems(added.slice(0, 1) as Item[]);
          }
          for (const it of added) void upload(it as Item);
        }}
        onRetry={(it) => void upload(it as Item)}
        onFilesRejected={(_, reason) =>
          toast({
            title: reason === "too-large" ? t("field.tooLarge") : t("field.tooMany"),
            description: reason === "too-large" ? t("field.tooLargeDesc") : t("field.tooManyDesc", { max }),
            status: "error",
          })
        }
        accept={field.accept ? ACCEPT[field.accept] : undefined}
        multiple={multiple}
        maxFiles={multiple ? max : 2}
        maxFileSize={200 * 1024 * 1024}
        title={
          field.accept === "video"
            ? t("field.dropVideo")
            : field.accept === "audio"
              ? t("field.dropAudio")
              : multiple
                ? t("field.dropImages")
                : t("field.dropImage")
        }
      />
    </div>
  );
}
