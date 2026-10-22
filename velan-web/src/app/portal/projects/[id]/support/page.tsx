import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { portalChatHref } from "../_components/portal-sections";

export const metadata: Metadata = { title: "Support" };

/**
 * Support moved into a chat box on the project overview; this keeps old links
 * (bookmarks, earlier notifications) working.
 */
export default function PortalSupportPage({ params }: PageProps<"/portal/projects/[id]/support">) {
  return (
    <Suspense fallback={null}>
      <RedirectToChat params={params} />
    </Suspense>
  );
}

async function RedirectToChat({ params }: { params: PageProps<"/portal/projects/[id]/support">["params"] }): Promise<never> {
  const { id } = await params;
  redirect(portalChatHref(id));
}
