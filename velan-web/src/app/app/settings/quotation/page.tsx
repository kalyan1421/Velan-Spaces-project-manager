import type { Metadata } from "next";
import { Suspense } from "react";
import { ForbiddenState } from "@/components/app-shell/states";
import { QuotationSettingsPage } from "@/components/sales-admin/quotation-settings-form";
import { SettingsSkeleton } from "@/components/sales-admin/sales-admin-skeleton";
import { SETTINGS_FORBIDDEN, initialOf, loadQuotationSettings } from "@/components/sales-admin/server";
import { requireRole } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Quotation settings" };

/** Head only: company details, branding and defaults for quotes. */
export default function QuotationSettingsRoute() {
  return (
    <Suspense fallback={<SettingsSkeleton />}>
      <QuotationSettingsContent />
    </Suspense>
  );
}

async function QuotationSettingsContent() {
  const user = await requireRole(["head", "manager", "worker"]);
  if (user.role !== "head") return <ForbiddenState message={SETTINGS_FORBIDDEN} />;

  const settings = await loadQuotationSettings();
  if (settings.kind === "forbidden") return <ForbiddenState message={SETTINGS_FORBIDDEN} />;

  // "unavailable": the client fetches again and shows its own error + retry.
  return <QuotationSettingsPage initialSettings={initialOf(settings)} />;
}
