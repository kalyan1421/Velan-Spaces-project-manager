/**
 * Files from drag-and-drop and paste. Dropping a folder (user story 15:
 * "drag a folder of site photos") yields its files, walked a few levels deep.
 */

const MAX_FILES = 200;
const MAX_DEPTH = 3;

const isHidden = (name: string) => name.startsWith(".");

function readEntries(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => reader.readEntries(resolve, () => resolve([])));
}

function fileOf(entry: FileSystemFileEntry): Promise<File | null> {
  return new Promise((resolve) => entry.file(resolve, () => resolve(null)));
}

async function collect(entry: FileSystemEntry, out: File[], depth: number): Promise<void> {
  if (out.length >= MAX_FILES || isHidden(entry.name)) return;
  if (entry.isFile) {
    const file = await fileOf(entry as FileSystemFileEntry);
    if (file) out.push(file);
    return;
  }
  if (!entry.isDirectory || depth >= MAX_DEPTH) return;
  const reader = (entry as FileSystemDirectoryEntry).createReader();
  // readEntries returns results in batches until an empty batch.
  for (;;) {
    const batch = await readEntries(reader);
    if (batch.length === 0) break;
    for (const child of batch) await collect(child, out, depth + 1);
    if (out.length >= MAX_FILES) break;
  }
}

/**
 * Must be called synchronously inside the `drop` handler (DataTransfer items
 * are only readable during the event); the returned promise may settle later.
 */
export function filesFromDataTransfer(dt: DataTransfer): Promise<File[]> {
  const items = Array.from(dt.items ?? []).filter((i) => i.kind === "file");
  const entries = items.map((i) => (typeof i.webkitGetAsEntry === "function" ? i.webkitGetAsEntry() : null));
  if (!entries.some((e) => e?.isDirectory)) {
    return Promise.resolve(Array.from(dt.files).filter((f) => !isHidden(f.name)));
  }
  const loose = items.map((i, index) => (entries[index] ? null : i.getAsFile()));
  return (async () => {
    const out: File[] = [];
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i];
      if (entry) await collect(entry, out, 0);
      else if (loose[i]) out.push(loose[i] as File);
    }
    return out.slice(0, MAX_FILES);
  })();
}

/** Files on the clipboard (screenshots, copied images). Empty for plain text pastes. */
export function filesFromClipboard(data: DataTransfer | null): File[] {
  if (!data) return [];
  const files = Array.from(data.files ?? []);
  if (files.length > 0) return files;
  return Array.from(data.items ?? [])
    .filter((i) => i.kind === "file")
    .map((i) => i.getAsFile())
    .filter((f): f is File => f !== null);
}

/** Clipboard images often arrive as "image.png"; give them a unique, descriptive name. */
export function namePastedFile(file: File, index: number, now: Date = new Date()): File {
  if (file.name && file.name !== "image.png" && file.name !== "image.jpg") return file;
  const ext = file.type === "image/jpeg" ? "jpg" : file.type === "image/webp" ? "webp" : "png";
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "-");
  return new File([file], `pasted-${stamp}-${index + 1}.${ext}`, { type: file.type || "image/png" });
}
