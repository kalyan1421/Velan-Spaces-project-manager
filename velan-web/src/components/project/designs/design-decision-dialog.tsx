"use client";

import { CircleCheck, MessageSquareDiff } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { APPROVAL_COMMENT_MAX, type ApprovalDesign } from "./design-api";
import { designTitle, validateDecisionComment } from "./design-utils";

export type DecisionMode = "approved" | "changes_requested";
export type DecisionRequest = { design: ApprovalDesign; mode: DecisionMode };

/**
 * Client confirmation before approving a design or asking for changes.
 * Approving takes an optional note; a change request needs one. The parent
 * saves optimistically, so the dialog closes as soon as it's confirmed.
 */
export function DesignDecisionDialog({
  request,
  onOpenChange,
  onConfirm,
}: {
  request: DecisionRequest | null;
  onOpenChange: (open: boolean) => void;
  onConfirm: (request: DecisionRequest, comment: string) => void;
}) {
  return (
    <Dialog open={request !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {request && (
          <DecisionForm
            key={`${request.design.id}-${request.mode}`}
            request={request}
            onConfirm={(comment) => onConfirm(request, comment)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function DecisionForm({ request, onConfirm }: { request: DecisionRequest; onConfirm: (comment: string) => void }) {
  const id = useId();
  const { design, mode } = request;
  const approving = mode === "approved";
  const title = designTitle(design);
  // Pre-fill a previous change request so the client can refine it.
  const [comment, setComment] = useState(!approving && design.approvalStatus === "changes_requested" ? design.approvalComment ?? "" : "");
  const [problem, setProblem] = useState<string | null>(null);
  const commentId = `${id}-comment`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const reason = validateDecisionComment(mode, comment);
    setProblem(reason);
    if (reason) {
      document.getElementById(commentId)?.focus();
      return;
    }
    onConfirm(comment.trim());
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>{approving ? "Approve this design?" : "Request changes"}</DialogTitle>
        <DialogDescription className="break-words">
          {approving
            ? `“${title}” will be marked as approved and your project team will be notified.`
            : `Tell the team what you'd like changed in “${title}”. They'll be notified and share a revised design.`}
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={commentId} className="text-sm font-medium text-ink">
          {approving ? (
            <>
              Note for the team <span className="font-normal text-muted-foreground">(optional)</span>
            </>
          ) : (
            "What would you like changed?"
          )}
        </label>
        <Textarea
          id={commentId}
          rows={4}
          value={comment}
          maxLength={APPROVAL_COMMENT_MAX}
          required={!approving}
          aria-invalid={problem ? true : undefined}
          aria-describedby={problem ? `${errorId} ${hintId}` : hintId}
          placeholder={approving ? "Anything to add?" : "e.g. Make the wardrobe wider and use a lighter laminate."}
          onChange={(e) => {
            setComment(e.target.value);
            if (problem) setProblem(null);
          }}
        />
        {problem && (
          <p id={errorId} role="alert" className="text-sm text-destructive">
            {problem}
          </p>
        )}
        <p id={hintId} className="text-xs text-muted-foreground">
          {comment.length > APPROVAL_COMMENT_MAX - 200
            ? `${APPROVAL_COMMENT_MAX - comment.length} characters left`
            : "Your project team sees this with the design."}
        </p>
      </div>
      <DialogFooter>
        <DialogClose render={<Button type="button" variant="outline" />}>Cancel</DialogClose>
        <Button type="submit">
          {approving ? (
            <CircleCheck data-icon="inline-start" aria-hidden />
          ) : (
            <MessageSquareDiff data-icon="inline-start" aria-hidden />
          )}
          {approving ? "Approve design" : "Send request"}
        </Button>
      </DialogFooter>
    </form>
  );
}
