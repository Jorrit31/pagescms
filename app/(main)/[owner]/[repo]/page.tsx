"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRepo } from "@/contexts/repo-context";
import { CONCEPT_BRANCH } from "@/lib/concept";

export default function Page() {
  const { owner, repo, defaultBranch, branches } = useRepo();
  const router = useRouter();

  useEffect(() => {
    // If no branch is provided, open the concept branch when there is one
    // (changes wait there until "Zet online"), otherwise the default branch.
    const branch = branches?.includes(CONCEPT_BRANCH) ? CONCEPT_BRANCH : defaultBranch;
    router.replace(`/${owner}/${repo}/${encodeURIComponent(branch as string)}`);
  }, [owner, repo, defaultBranch, branches, router]);
  
  return null;
};
