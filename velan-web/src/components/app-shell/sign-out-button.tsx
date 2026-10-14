"use client";

import { Loader2, LogOut } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/sign-out";

export function SignOutButton({
  variant = "outline",
  size = "default",
  className,
}: {
  variant?: "outline" | "ghost" | "destructive" | "default";
  size?: "default" | "sm" | "lg";
  className?: string;
}) {
  const [pending, setPending] = useState(false);
  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      disabled={pending}
      onClick={() => {
        setPending(true);
        void signOut();
      }}
    >
      {pending ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
