import { SearchX } from "lucide-react";
import Link from "next/link";
import { StateMessage } from "@/components/app-shell/states";
import { buttonVariants } from "@/components/ui/button";

export default function AppNotFound() {
  return (
    <StateMessage
      icon={SearchX}
      title="We couldn't find that"
      description="The page or project may have been moved, deleted, or you may not have access to it."
      action={
        <Link href="/app/projects" className={buttonVariants({ variant: "outline" })}>
          Back to projects
        </Link>
      }
    />
  );
}
