"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { emailOtp, signIn } from "@/lib/auth-client";
import { getAuthCallbackURL, getSafeRedirect } from "@/lib/auth-redirect";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OtpVerificationForm } from "@/components/otp-verification-form";
import { toast } from "sonner";
import { Check, Loader } from "lucide-react";
import { t } from "@/lib/i18n";
import { brand } from "@/lib/brand";
import { BrandWordmark } from "@/components/brand-mark";

export function SignIn({ githubConnected = true }: { githubConnected?: boolean }) {
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"email" | "otp">("email");
  const [submittingMethod, setSubmittingMethod] = useState<
    "github" | "email" | "otp" | null
  >(null);
  const isSubmitting = submittingMethod !== null;

  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "";
  const redirectParam = searchParams.get("redirect") || "";
  const safeRedirect = getSafeRedirect(redirectParam);
  const callbackURL = getAuthCallbackURL(safeRedirect);
  const errorCallbackURL =
    safeRedirect === "/"
      ? "/sign-in"
      : `/sign-in?redirect=${encodeURIComponent(safeRedirect)}`;

  const getErrorMessage = (value: string) => {
    if (value.toLowerCase() !== "unable_to_get_user_info") return value;
    return [
      "GitHub denied profile access. Re-authorize this editor in GitHub Settings > Applications > Authorized GitHub Apps / Authorized OAuth Apps, then try again.",
      "https://github.com/settings/applications",
    ].join(" ");
  };

  useEffect(() => {
    if (error) toast.error(getErrorMessage(error), { duration: 12000 });
  }, [error]);

  useEffect(() => {
    const email = searchParams.get("email");
    if (email) setEmail(email.trim().toLowerCase());
  }, [searchParams]);

  const handleGithubSignIn = async () => {
    setSubmittingMethod("github");
    try {
      const result = await signIn.social({
        provider: "github",
        callbackURL,
        errorCallbackURL,
        disableRedirect: true,
      });
      if (result.error?.message) {
        toast.error(result.error.message);
        setSubmittingMethod(null);
        return;
      }

      if (result.data?.url) {
        window.location.assign(result.data.url);
        return;
      }

      setSubmittingMethod(null);
      toast.error("Could not start GitHub sign-in. Please try again.");
    } catch (error: any) {
      toast.error(error?.message || "Could not start GitHub sign-in.");
      setSubmittingMethod(null);
    }
  };

  const handleEmailSignIn = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast.error(t("Invalid email"));
      return;
    }

    setSubmittingMethod("email");
    try {
      const result = await emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      });

      if (result.error?.message) {
        toast.error(result.error.message);
        return;
      }

      setEmail(normalizedEmail);
      setOtp("");
      setStep("otp");
      toast.success(t("We sent you a sign-in code."), { duration: 8000 });
    } finally {
      setSubmittingMethod(null);
    }
  };

  const handleOtpSignIn = async () => {
    if (otp.length !== 6) {
      toast.error(t("Enter the 6-digit code."));
      return;
    }

    setSubmittingMethod("otp");
    try {
      const result = await signIn.emailOtp({
        email,
        otp,
      });

      if (result.error?.message) {
        toast.error(result.error.message);
        return;
      }

      window.location.assign(safeRedirect);
    } finally {
      setSubmittingMethod(null);
    }
  };

  const resetToFullSignIn = () => {
    setStep("email");
    setOtp("");
  };

  const legalLinks = [
    brand.termsUrl ? { href: brand.termsUrl, label: t("Terms of Service") } : null,
    brand.privacyUrl ? { href: brand.privacyUrl, label: t("Privacy Policy") } : null,
  ].filter((link): link is { href: string; label: string } => link !== null);

  const legalCopy = legalLinks.length > 0 ? (
    <p className="text-sm text-muted-foreground">
      {t("By continuing, you agree to:")}{" "}
      {legalLinks.map((link, index) => (
        <span key={link.href}>
          {index > 0 && " & "}
          <a
            className="underline hover:decoration-muted-foreground/50"
            href={link.href}
            target="_blank"
            rel="noreferrer noopener"
          >
            {link.label}
          </a>
        </span>
      ))}
    </p>
  ) : null;

  const builderLink = (
    <button
      type="button"
      onClick={handleGithubSignIn}
      disabled={isSubmitting || !githubConnected}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
    >
      {t("Website builder? Sign in with GitHub")}
      {submittingMethod === "github" && <Loader className="size-3.5 animate-spin" />}
    </button>
  );

  return (
    <div className="min-h-screen grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] bg-background">
      <aside
        className="hidden lg:flex flex-col justify-between p-12 xl:p-16"
        style={{ background: "var(--brand-panel)", color: "var(--brand-panel-foreground)" }}
      >
        <BrandWordmark className="text-lg" markClassName="size-9" />
        <div className="max-w-md space-y-8">
          <h2 className="text-4xl xl:text-[2.75rem] font-semibold leading-[1.1] tracking-tight">
            {t("Edit your website as easily as sending a text message.")}
          </h2>
          <ul className="space-y-4 text-lg opacity-90">
            {[
              t("Type your text or pick a photo"),
              t("See right away how it looks"),
              t("Done? One click and it is online"),
            ].map((line) => (
              <li key={line} className="flex items-center gap-3">
                <Check className="size-5 shrink-0" style={{ color: "var(--brand-dot)" }} />
                {line}
              </li>
            ))}
          </ul>
        </div>
        <p className="text-sm opacity-70">{t("Need help? Your web designer is happy to help.")}</p>
      </aside>
      <div className="flex min-h-screen flex-col p-6 sm:p-10">
        <div className="lg:hidden"><BrandWordmark /></div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full sm:max-w-[400px]">
            {step === "otp" ? (
              <div className="space-y-6">
                <OtpVerificationForm
                  busy={isSubmitting}
                  emailLabel={email}
                  otp={otp}
                  pending={submittingMethod === "otp"}
                  resendDisabled={submittingMethod === "otp"}
                  resendPending={submittingMethod === "email"}
                  onChange={setOtp}
                  onResend={() => void handleEmailSignIn()}
                  onSignInAnotherWay={resetToFullSignIn}
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await handleOtpSignIn();
                  }}
                />
                {legalCopy}
              </div>
            ) : (
              <div className="space-y-8">
                <div className="space-y-3">
                  <h1 className="text-3xl font-semibold tracking-tight">{t("Welcome back")}</h1>
                  <p className="text-lg text-muted-foreground">
                    {t("Fill in your email address. We will email you a code, no password needed.")}
                  </p>
                </div>
                {!githubConnected && (
                  <div className="rounded-lg border bg-card p-4 text-sm space-y-3">
                    <p>{t("This editor is not connected to GitHub yet.")}</p>
                    <Button asChild variant="outline" className="w-full">
                      <Link href="/setup">{t("Set up now")}</Link>
                    </Button>
                  </div>
                )}
                <form
                  className="space-y-4"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    await handleEmailSignIn();
                  }}
                >
                  <label className="block space-y-2">
                    <span className="text-sm font-medium">{t("Your email address")}</span>
                    <Input
                      className="h-13 bg-card text-base px-4"
                      type="email"
                      name="email"
                      placeholder={t("name@example.com")}
                      required
                      disabled={isSubmitting}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                    />
                  </label>
                  <Button type="submit" size="lg" className="h-13 w-full text-base font-semibold" disabled={isSubmitting}>
                    {t("Send me a sign-in code")}
                    {submittingMethod === "email" && <Loader className="size-4 animate-spin" />}
                  </Button>
                </form>
                {legalCopy}
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-center lg:justify-end">{builderLink}</div>
      </div>
    </div>
  );
}
