"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { MailPlus, RefreshCw } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { StateMessage } from "@/components/app-shell/states";
import { ShareLinkPanel } from "@/components/staff/share-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  accountsApi,
  clientInvitesQueryKey,
  inviteMessage,
  type ClientInvite,
  type ClientInviteBody,
  type ClientInviteValues,
} from "@/lib/api/accounts";
import { ClientInviteForm, EMPTY_INVITE } from "./client-invite-form";
import { ClientInvitesList } from "./client-invites-list";

type NewLink = { url: string; expiresAt: string | null; email: string; name: string };

/** Client access tab: invite a client by link and track the project's invites. */
export function ClientAccessPanel({
  projectId,
  projectName,
  initialInvites,
}: {
  projectId: string;
  projectName: string;
  initialInvites: ClientInvite[];
}) {
  const queryClient = useQueryClient();
  const queryKey = clientInvitesQueryKey(projectId);
  const invites = useQuery({
    queryKey,
    queryFn: () => accountsApi.listClientInvites(projectId),
    initialData: initialInvites,
  });
  const invite = useMutation({
    mutationFn: (body: ClientInviteBody) => accountsApi.inviteClient(projectId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  // The new link is kept only in this component's state (it's a credential) until dismissed.
  const [newLink, setNewLink] = useState<NewLink | null>(null);
  const [defaults, setDefaults] = useState<ClientInviteValues>(EMPTY_INVITE);
  const [formKey, setFormKey] = useState(0);
  const formCardRef = useRef<HTMLDivElement>(null);

  const startOver = (values: ClientInviteValues = EMPTY_INVITE) => {
    setNewLink(null);
    setDefaults(values);
    setFormKey((k) => k + 1);
    formCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    requestAnimationFrame(() => document.getElementById("invite-email")?.focus());
  };

  const list = invites.data ?? [];

  return (
    <div className="grid items-start gap-4 lg:grid-cols-5">
      <Card ref={formCardRef} className="scroll-mt-20 lg:col-span-2">
        <CardHeader>
          <CardTitle>Invite a client</CardTitle>
          <CardDescription>
            The client opens the link and sets their own password — you never see or share it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {newLink ? (
            <div className="flex flex-col gap-4" role="status">
              <p className="text-sm text-ink">
                Invite ready for <span className="font-medium">{newLink.name}</span>. Send them this link:
              </p>
              <ShareLinkPanel
                label="Invite link"
                url={newLink.url}
                expiresAt={newLink.expiresAt}
                message={inviteMessage({ name: newLink.name, projectName, url: newLink.url, expiresAt: newLink.expiresAt })}
                emailTo={newLink.email}
                emailSubject={`Your Velan Spaces invite for ${projectName}`}
                note="Send it only to the client. It can be used once."
              />
              <Button type="button" variant="outline" size="lg" className="w-full sm:w-fit" onClick={() => startOver()}>
                <MailPlus data-icon="inline-start" aria-hidden />
                Invite someone else
              </Button>
            </div>
          ) : (
            <ClientInviteForm
              key={formKey}
              defaults={defaults}
              invite={(body) => invite.mutateAsync(body)}
              onInvited={(result, body) => {
                if (result.alreadyRegistered || !result.inviteUrl) {
                  toast.success(`${body.email} already has an account — they now have access to ${projectName}.`);
                  return;
                }
                setNewLink({ url: result.inviteUrl, expiresAt: result.expiresAt, email: body.email, name: body.displayName });
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Invites
            {invites.isFetching && <RefreshCw className="size-3.5 animate-spin text-muted-foreground" aria-label="Refreshing" />}
          </CardTitle>
          <CardDescription>Links expire after 7 days and work once. Lost or expired? Create a new link.</CardDescription>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <StateMessage
              icon={MailPlus}
              title="No invites yet"
              description="Invite the client so they can follow progress, photos and designs from their phone."
              className="border-0 py-8"
            />
          ) : (
            <ClientInvitesList
              invites={list}
              onResend={(i) => startOver({ email: i.email ?? "", displayName: i.displayName ?? "", phone: i.phone ?? "" })}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
