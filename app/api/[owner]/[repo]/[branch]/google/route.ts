export const maxDuration = 30;

import { type NextRequest } from "next/server";
import { readFns } from "@/fields/registry";
import { parse } from "@/lib/serialization";
import { deepMap, getPrimaryField, safeAccess } from "@/lib/schema";
import { getRepoReadContext } from "@/lib/api-repo-context";
import { getCollectionCache } from "@/lib/github-cache-file";
import { createOctokitInstance } from "@/lib/utils/octokit";
import { toErrorResponse } from "@/lib/api-error";
import { findSeoField, pickLanguage, type SeoOverviewPage } from "@/lib/seo-shared";

/**
 * Webstudio: the "Google" overview. Every page (file or collection entry) whose
 * schema has a `seo: true` field, with what is filled in there now.
 *
 * GET /api/[owner]/[repo]/[branch]/google
 *
 * Uses the config as restricted for this person, so a client only sees the
 * pages they may change.
 */

const SERIALIZED = ["yaml-frontmatter", "json-frontmatter", "toml-frontmatter", "yaml", "json", "toml"];

const readEntry = (content: string, schema: any, config: any) => {
  const parsed = parse(content, { format: schema.format, delimiters: schema.delimiters });
  return deepMap(parsed, schema.fields, (value, field) => {
    if (typeof field.type === "string" && readFns[field.type]) return readFns[field.type](value, field, config);
    return value;
  });
};

const pageName = (fields: Record<string, any>, schema: any, fallback: string) => {
  const primary = getPrimaryField(schema);
  const value = primary ? safeAccess(fields, primary) : undefined;
  const text = pickLanguage(value);
  return text || fallback;
};

const toPage = (schema: any, seoField: any, path: string, name: string, fields: Record<string, any>): SeoOverviewPage => {
  const value = (fields?.[seoField.name] ?? {}) as Record<string, any>;
  const photoField = (seoField.fields ?? []).find((sub: any) => sub?.name === "foto");
  return {
    entry: schema.name,
    entryLabel: schema.label || schema.name,
    type: schema.type,
    path,
    name,
    field: seoField.name,
    media: photoField?.options?.media,
    value: {
      titel: value.titel ?? "",
      omschrijving: value.omschrijving ?? "",
      foto: typeof value.foto === "string" && value.foto ? value.foto : null,
    },
  };
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ owner: string; repo: string; branch: string }> },
) {
  try {
    const params = await context.params;
    const { token, config } = await getRepoReadContext(params);
    const configObject: any = config.object ?? {};
    const content: any[] = Array.isArray(configObject.content) ? configObject.content : [];
    const octokit = createOctokitInstance(token);

    const groups = await Promise.all(content.map(async (schema: any): Promise<SeoOverviewPage[]> => {
      const seoField = findSeoField(schema?.fields);
      if (!seoField || !SERIALIZED.includes(schema.format)) return [];

      if (schema.type === "file") {
        let fields: Record<string, any> = {};
        try {
          const response = await octokit.rest.repos.getContent({ owner: params.owner, repo: params.repo, path: schema.path, ref: params.branch });
          if (!Array.isArray(response.data) && response.data.type === "file") {
            fields = readEntry(Buffer.from(response.data.content, "base64").toString(), schema, config);
          }
        } catch (error: any) {
          if (error?.status !== 404) console.error(`Google overview: could not read ${schema.path}: ${error?.message}`);
        }
        return [toPage(schema, seoField, schema.path, schema.label || schema.name, fields)];
      }

      if (schema.type === "collection") {
        const extension = schema.extension ?? "";
        const exclude: string[] = schema.exclude || [];
        let entries: any[] = [];
        try {
          entries = await getCollectionCache(params.owner, params.repo, params.branch, schema.path, token, schema.view?.node?.filename);
        } catch (error: any) {
          console.error(`Google overview: could not list ${schema.path}: ${error?.message}`);
          return [];
        }
        return entries
          .filter((item: any) => item.type === "file" && (extension === "" || item.path.endsWith(`.${extension}`)) && !exclude.includes(item.name))
          .map((item: any) => {
            let fields: Record<string, any> = {};
            try {
              fields = readEntry(item.content, schema, config);
            } catch {
              // An entry that can't be read still shows, as not filled in.
            }
            const fallback = String(item.name).replace(/\.[^.]+$/, "");
            return toPage(schema, seoField, item.path, pageName(fields, schema, fallback), fields);
          })
          .sort((a, b) => {
            // Dated entries (news) newest first, the rest by name.
            const dated = /^\d{4}-\d{2}-\d{2}/;
            const fileA = a.path.split("/").pop() || "";
            const fileB = b.path.split("/").pop() || "";
            if (dated.test(fileA) && dated.test(fileB)) return fileB.localeCompare(fileA);
            return a.name.localeCompare(b.name, "nl");
          });
      }
      return [];
    }));

    return Response.json({ status: "success", data: { pages: groups.flat() } });
  } catch (error: any) {
    console.error(error);
    return toErrorResponse(error);
  }
}
