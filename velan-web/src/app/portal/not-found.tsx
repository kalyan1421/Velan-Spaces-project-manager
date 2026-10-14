import { SearchX } from "lucide-react";
import Link from "next/link";
import { StateMessage } from "@/components/app-shell/states";
import { buttonVariants } from "@/components/ui/button";

export default function PortalNotFound() {
  return (
    <StateMessage
      icon={SearchX}
      title="We couldn't find that"
      description="The page may have moved, or the project isn't on your account."
      action={
        <Link href="/portal" className={buttonVariants({ variant: "outline" })}>
          Back to your projects
        </Link>
      }
    />
  );
}
