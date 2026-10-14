"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { StateMessage } from "@/components/app-shell/states";
import { Button } from "@/components/ui/button";

export default function PortalError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StateMessage
      icon={TriangleAlert}
      tone="warning"
      title="Something went wrong"
      description="This page couldn't load. Please try again in a moment."
      action={
        <Button onClick={() => retry()}>
          <RotateCcw aria-hidden />
          Try again
        </Button>
      }
    />
  );
}
