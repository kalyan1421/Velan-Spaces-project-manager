"use client";

import { RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { StateMessage } from "@/components/app-shell/states";
import { Button, buttonVariants } from "@/components/ui/button";

export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StateMessage
      icon={TriangleAlert}
      tone="warning"
      title="Something went wrong"
      description={
        <>
          <p>This page couldn&apos;t load. It may be a temporary problem with the server.</p>
          {error.digest && <p className="mt-2 font-mono text-xs">Reference: {error.digest}</p>}
        </>
      }
      action={
        <>
          <Button onClick={() => retry()}>
            <RotateCcw aria-hidden />
            Try again
          </Button>
          <Link href="/app/projects" className={buttonVariants({ variant: "outline" })}>
            Go to projects
          </Link>
        </>
      }
    />
  );
}
