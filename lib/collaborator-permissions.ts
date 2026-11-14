import { db } from "@/db";
import { hasGithubIdentity } from "@/lib/authz-shared";
import { collaboratorMatchesUserForRepo } from "@/lib/collaborator-access";
import type { Config } from "@/types/config";
import type { User } from "@/types/user";

/**
 * What a client (collaborator) may edit, set per person on the
 * collaborators page. null means everything (also for GitHub users).
 */
const getAllowedContent = async (
  user: Pick<User, "id" | "email"> & { githubUsername?: string | null },
  owner: string,
  repo: string,
): Promise<string[] | null> => {
  if (hasGithubIdentity(user as any)) return null;
  const collaborator = await db.query.collaboratorTable.findFirst({
    where: collaboratorMatchesUserForRepo(user, owner, repo),
  });
  return parsePermissions(collaborator?.permissions);
};

const parsePermissions = (value?: string | null): string[] | null => {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : null;
  } catch {
    return null;
  }
};

const filterNavigation = (nodes: any[], allowed: Set<string>): any[] => (
  nodes.flatMap((node) => {
    if (node?.type === "group") {
      const items = filterNavigation(node.items ?? [], allowed);
      return items.length > 0 ? [{ ...node, items }] : [];
    }
    if (node?.type === "media") return [node];
    return allowed.has(node?.name) ? [node] : [];
  })
);

/** The config with only the content this user may edit. */
const restrictConfig = <T extends Config | null | undefined>(config: T, allowed: string[] | null): T => {
  if (!config || !allowed || !config.object) return config;
  const allowedSet = new Set(allowed);
  const object: any = { ...config.object };
  if (Array.isArray(object.content)) {
    object.content = object.content.filter((item: any) => allowedSet.has(item?.name));
  }
  if (Array.isArray(object.navigation?.content)) {
    object.navigation = { ...object.navigation, content: filterNavigation(object.navigation.content, allowedSet) };
  }
  return { ...config, object } as T;
};

const restrictConfigForUser = async <T extends Config | null | undefined>(
  config: T,
  user: Pick<User, "id" | "email"> & { githubUsername?: string | null },
  owner: string,
  repo: string,
): Promise<T> => {
  if (!config) return config;
  return restrictConfig(config, await getAllowedContent(user, owner, repo));
};

export { getAllowedContent, parsePermissions, restrictConfig, restrictConfigForUser };
