"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PORTFOLIO_STATUSES } from "@/lib/api/portfolio-admin";
import type { PortfolioItem, PortfolioStatus } from "@/lib/api/types";
import { STATUS_DESCRIPTIONS, STATUS_LABELS } from "./portfolio-rules";

function isStatus(value: unknown): value is PortfolioStatus {
  return typeof value === "string" && (PORTFOLIO_STATUSES as readonly string[]).includes(value);
}

/** Per-row overflow menu: status (publish / draft / hide), edit, delete. */
export function PortfolioRowMenu({
  item,
  disabled,
  onStatusChange,
  onDelete,
}: {
  item: PortfolioItem;
  disabled?: boolean;
  onStatusChange: (item: PortfolioItem, status: PortfolioStatus) => void;
  onDelete: (item: PortfolioItem) => void;
}) {
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={<Button variant="ghost" size="icon-sm" disabled={disabled} aria-label={`More actions for “${item.title}”`} />}
      >
        <MoreHorizontal aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuGroup>
          <DropdownMenuLabel>Status</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={item.status}
            onValueChange={(value) => {
              if (isStatus(value) && value !== item.status) onStatusChange(item, value);
            }}
          >
            {PORTFOLIO_STATUSES.map((status) => (
              <DropdownMenuRadioItem key={status} value={status} className="items-start">
                <span className="flex flex-col">
                  <span>{STATUS_LABELS[status]}</span>
                  <span className="text-xs text-muted-foreground">{STATUS_DESCRIPTIONS[status]}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => router.push(`/app/website/${item.id}`)}>
            <Pencil aria-hidden />
            Edit details and photos
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => onDelete(item)}>
            <Trash2 aria-hidden />
            Delete…
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
