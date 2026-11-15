import fs from "node:fs";
import path from "node:path";
import { DOWNLOAD_MEDIA, MEDIA_DIR } from "./config.ts";
import { getSetting, setSetting } from "./db.ts";

/** Where generated media is saved. Settings screen > .env > default (data/media). */
export function getMediaDir(): string {
  return getSetting("mediaDir") || MEDIA_DIR;
}

/** Whether finished outputs are copied to disk. Settings screen > .env > true. */
export function getDownloadMedia(): boolean {
  const saved = getSetting("downloadMedia");
  return saved === undefined ? DOWNLOAD_MEDIA : saved === "true";
}

export interface StorageSettings {
  downloadMedia: boolean;
  mediaDir: string;
  defaultMediaDir: string;
}

export function storageSettings(): StorageSettings {
  return { downloadMedia: getDownloadMedia(), mediaDir: getMediaDir(), defaultMediaDir: MEDIA_DIR };
}

export class StorageError extends Error {}

/** Validates and saves the storage settings. Throws StorageError with a friendly message. */
export function updateStorage(input: { downloadMedia?: boolean; mediaDir?: string | null }) {
  if (typeof input.downloadMedia === "boolean") {
    setSetting("downloadMedia", String(input.downloadMedia));
  }
  if (input.mediaDir === null || input.mediaDir === "") {
    setSetting("mediaDir", null); // back to the default folder
  } else if (typeof input.mediaDir === "string") {
    const raw = input.mediaDir.trim();
    if (!path.isAbsolute(raw)) {
      throw new StorageError("Informe um caminho completo, por exemplo C:\\Users\\voce\\Videos\\kieStudio ou /home/voce/kiestudio.");
    }
    const dir = path.resolve(raw);
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, `.kiestudio-write-test-${process.pid}`);
      fs.writeFileSync(probe, "ok");
      fs.rmSync(probe, { force: true });
    } catch (err) {
      throw new StorageError(`Não foi possível gravar em "${dir}": ${(err as NodeJS.ErrnoException).code ?? (err as Error).message}`);
    }
    setSetting("mediaDir", dir === MEDIA_DIR ? null : dir);
  }
  return storageSettings();
}

/**
 * Resolves a stored file reference to an absolute path. Older rows stored a
 * bare file name inside the default media folder; newer rows store the
 * absolute path so changing the folder never breaks existing items.
 */
export function resolveStoredFile(ref: string): string {
  return path.isAbsolute(ref) ? ref : path.join(MEDIA_DIR, path.basename(ref));
}
