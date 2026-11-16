"use client";

/**
 * Webstudio: "Bekijk als klant". A website builder (signed in with GitHub) can see
 * the CMS exactly as a client sees it: no GitHub, no branches, no builder tools.
 * Only what is shown changes; what the builder may do on the server stays the same.
 */
import { useSyncExternalStore } from "react";
import { useUser } from "@/contexts/user-context";
import { hasGithubIdentity } from "@/lib/authz-shared";

const KEY = "webstudio-klantweergave";
const EVENT = "webstudio-klantweergave";

const read = () => {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
};

const subscribe = (callback: () => void) => {
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", callback);
  };
};

export const setClientView = (on: boolean) => {
  try {
    if (on) window.localStorage.setItem(KEY, "1");
    else window.localStorage.removeItem(KEY);
  } catch {
    // Private mode: the switch just doesn't stick.
  }
  window.dispatchEvent(new Event(EVENT));
};

/** True while a builder looks at the CMS as a client. */
export function useClientView(): boolean {
  return useSyncExternalStore(subscribe, read, () => false);
}

/** True when the builder's tools (GitHub, branches, settings) should show. */
export function useIsBuilderView(): boolean {
  const { user } = useUser();
  const clientView = useClientView();
  return hasGithubIdentity(user) && !clientView;
}
