import { FileSpreadsheet, FileText, Film, ImageIcon, File as FileIcon, Presentation } from "lucide-react";
import { extensionOf } from "@/lib/uploads";
import { cn } from "@/lib/utils";

const BY_EXT: Record<string, typeof FileText> = {
  pdf: FileText,
  doc: FileText,
  docx: FileText,
  txt: FileText,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  csv: FileSpreadsheet,
  ppt: Presentation,
  pptx: Presentation,
  jpg: ImageIcon,
  jpeg: ImageIcon,
  png: ImageIcon,
  webp: ImageIcon,
  heic: ImageIcon,
  heif: ImageIcon,
  gif: ImageIcon,
  mp4: Film,
  mov: Film,
  m4v: Film,
};

/** Type icon in a tinted square, picked from the file name's extension. */
export function FileTypeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = BY_EXT[extensionOf(name)] ?? FileIcon;
  return (
    <span
      aria-hidden
      className={cn("grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground", className)}
    >
      <Icon className="size-4.5" />
    </span>
  );
}
