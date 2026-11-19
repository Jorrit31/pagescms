import { notFound } from "next/navigation";
import { MainRootLayout } from "../main-root-layout";
import { AgencyDashboard } from "@/components/agency-dashboard";
import { DocumentTitle } from "@/components/document-title";
import { requireAdminSession } from "@/lib/admin";
import { listSites } from "@/lib/agency";
import { getLatestReports } from "@/lib/monthly-report";

/** Webstudio: "Klanten", all clients and their websites. Only for ADMIN_EMAILS. */
export default async function Page() {
  try {
    await requireAdminSession();
  } catch {
    notFound();
  }
  const [list, reports] = await Promise.all([listSites(), getLatestReports()]);
  const sites = list.map((site) => ({ ...site, lastReport: reports.get(`${site.owner.toLowerCase()}/${site.repo.toLowerCase()}`) ?? null }));

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
