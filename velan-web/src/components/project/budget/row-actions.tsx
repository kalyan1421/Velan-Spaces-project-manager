"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Per-row Edit/Delete menu (one tab stop per row). The handlers receive the
 * menu button so the dialog they open can hand focus back to it on close.
 */
export function RowActions({
  label,
  onEdit,
  onDelete,
}: {
  /** Describes the row for screen readers, e.g. "expense of ₹5,000 on 12 Oct 2026". */
  label: string;
  onEdit: (returnFocus: HTMLElement | null) => void;
  onDelete: (returnFocus: HTMLElement | null) => void;
}) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        ref={triggerRef}
        render={<Button variant="ghost" size="icon-sm" aria-label={`Actions for ${label}`} />}
      >
        <MoreHorizontal aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-36">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => onEdit(triggerRef.current)}>
            <Pencil aria-hidden />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(triggerRef.current)}>
            <Trash2 aria-hidden />
            Delete
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
