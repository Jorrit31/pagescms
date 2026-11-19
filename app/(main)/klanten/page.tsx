import { notFound } from "next/navigation";
import { MainRootLayout } from "../main-root-layout";
import { AgencyDashboard } from "@/components/agency-dashboard";
import { DocumentTitle } from "@/components/document-title";
import { requireAdminSession } from "@/lib/admin";
import { listSites } from "@/lib/agency";

/** Webstudio: "Klanten", all clients and their websites. Only for ADMIN_EMAILS. */
export default async function Page() {
  try {
    await requireAdminSession();
  } catch {
    notFound();
  }
  const sites = await listSites();

  return (
    <MainRootLayout>
      <DocumentTitle title="Klanten" />
      <div className="max-w-screen-lg mx-auto p-4 md:p-6 space-y-6">
        <header className="space-y-1">
          <h1 className="font-semibold tracking-tight text-xl md:text-2xl">Klanten</h1>
          <p className="text-sm text-muted-foreground">Al je klanten en hun websites. Wat aandacht nodig heeft, staat bovenaan.</p>
        </header>
        <AgencyDashboard initialSites={sites} />
      </div>
    </MainRootLayout>
  );
}
