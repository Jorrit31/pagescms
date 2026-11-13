import { InviteSignIn } from "@/components/invite-sign-in";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { t } from "@/lib/i18n";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  if (!token?.trim()) {
    return (
      <Empty className="absolute inset-0 border-0 rounded-none">
        <EmptyHeader>
          <EmptyTitle>{t("Invite unavailable")}</EmptyTitle>
          <EmptyDescription>{t("This invitation link is invalid.")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return <InviteSignIn token={token.trim()} />;
}
