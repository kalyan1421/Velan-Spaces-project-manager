"use client";

import { useQuery } from "@tanstack/react-query";
import { MessageSquareWarning, MessagesSquare } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { projectOps, projectOpsKeys } from "@/lib/api/project-ops";
import type { Role } from "@/lib/api/types";
import { ChatPanel } from "./chat-panel";
import { ComplaintsPanel } from "./complaints-panel";
import { complaintCounts } from "./support-model";

/**
 * Support for one project: chat with the team + complaints. `page` is the staff
 * Support tab; `box` is the compact chat box on the client portal overview.
 */
export function SupportView({
  projectId,
  viewer,
  variant = "page",
}: {
  projectId: string;
  viewer: { id: string; role: Role };
  variant?: "page" | "box";
}) {
  // Same key as the complaints panel, so this only reads the shared cache entry.
  const complaints = useQuery({
    queryKey: projectOpsKeys.complaints(projectId),
    queryFn: () => projectOps.listComplaints(projectId),
  });
  const counts = complaintCounts(complaints.data ?? []);
  const active = counts.open + counts.inProgress;

  const box = variant === "box";

  return (
    <section
      aria-labelledby="support-heading"
      className={box ? "flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10" : "flex flex-col gap-4"}
    >
      <div>
        <h2 id="support-heading" className={box ? "font-heading text-base font-semibold text-ink" : "font-heading text-lg font-semibold text-ink"}>
          {box ? "Chat with your team" : "Support"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {box
            ? "Ask anything about your project. Replies appear here automatically."
            : viewer.role === "client"
              ? "Message the project team or raise a complaint. New messages appear automatically."
              : "Chat with the client and team, and track complaints to resolution."}
        </p>
      </div>
      <Tabs defaultValue="chat">
        <TabsList className={box ? "w-full" : "w-full sm:w-fit"}>
          <TabsTrigger value="chat">
            <MessagesSquare aria-hidden />
            Chat
          </TabsTrigger>
          <TabsTrigger value="complaints">
            <MessageSquareWarning aria-hidden />
            Complaints
            {active > 0 && (
              <span className="ml-0.5 rounded-full bg-gold px-1.5 text-xs font-semibold text-ink tabular-nums">
                {active}
                <span className="sr-only"> active</span>
              </span>
            )}
          </TabsTrigger>
        </TabsList>
        {/* Kept mounted so a half-written message or an in-flight upload survives switching tabs. */}
        <TabsContent value="chat" keepMounted className="pt-2">
          <ChatPanel
            projectId={projectId}
            viewerId={viewer.id}
            heightClassName={box ? "h-[min(50dvh,24rem)] min-h-60" : undefined}
          />
        </TabsContent>
        <TabsContent value="complaints" keepMounted className="pt-2">
          <ComplaintsPanel projectId={projectId} role={viewer.role} />
        </TabsContent>
      </Tabs>
    </section>
  );
}
