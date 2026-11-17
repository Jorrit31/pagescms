import { type NextRequest } from "next/server";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { formSubmissionTable } from "@/db/schema";
import { createHttpError, toErrorResponse } from "@/lib/api-error";
import { getRepoReadContext } from "@/lib/api-repo-context";
import { getAllowedContent } from "@/lib/collaborator-permissions";
import { MESSAGES_PERMISSION } from "@/lib/forms";

/**
 * Messages sent with the forms on the website ("Berichten").
 *
 * GET    ?summary=1  -> { unread, total }
 * GET                -> { messages: [...] } (newest first, max 200)
 * PATCH  { id, read } -> mark as read / unread
 * DELETE ?id=...     -> remove
 */

type Params = { params: Promise<{ owner: string; repo: string; branch: string }> };

const requireMessagesAccess = async (params: { owner: string; repo: string; branch: string }) => {
  const { user } = await getRepoReadContext(params);
  const allowed = await getAllowedContent(user, params.owner, params.repo);
  if (allowed && !allowed.includes(MESSAGES_PERMISSION)) {
    throw createHttpError("You can't see the messages of this website.", 403);
  }
};

const forSite = (owner: string, repo: string) => and(
  sql`lower(${formSubmissionTable.owner}) = lower(${owner})`,
  sql`lower(${formSubmissionTable.repo}) = lower(${repo})`,
);

export async function GET(request: NextRequest, context: Params) {
  try {
    const params = await context.params;
    await requireMessagesAccess(params);

    if (request.nextUrl.searchParams.get("summary")) {
      const [row] = await db
        .select({
          total: sql<number>`count(*)::int`,
          unread: sql<number>`count(*) filter (where ${formSubmissionTable.readAt} is null)::int`,
        })
        .from(formSubmissionTable)
        .where(forSite(params.owner, params.repo));
      return Response.json({ status: "success", data: { total: row?.total ?? 0, unread: row?.unread ?? 0 } });
    }

    const rows = await db
      .select()
      .from(formSubmissionTable)
      .where(forSite(params.owner, params.repo))
      .orderBy(desc(formSubmissionTable.createdAt))
      .limit(200);

    return Response.json({
      status: "success",
      data: {
        messages: rows.map((row) => ({
          id: row.id,
          form: row.form,
          fields: row.fields,
          email: row.email,
          page: row.page,
          mailed: row.mailed,
          createdAt: row.createdAt,
          readAt: row.readAt,
        })),
      },
    });
  } catch (error: any) {
    if (!error?.status) console.error(error);
    return toErrorResponse(error);
  }
}

export async function PATCH(request: NextRequest, context: Params) {
  try {
    const params = await context.params;
    await requireMessagesAccess(params);
    const body = await request.json().catch(() => null);
    const id = Number(body?.id);
    if (!Number.isInteger(id)) throw createHttpError("\"id\" is required.", 400);
    const read = body?.read !== false;
    const where = read
      ? and(forSite(params.owner, params.repo), eq(formSubmissionTable.id, id), isNull(formSubmissionTable.readAt))
      : and(forSite(params.owner, params.repo), eq(formSubmissionTable.id, id));
    await db.update(formSubmissionTable).set({ readAt: read ? new Date() : null }).where(where);
    return Response.json({ status: "success" });
  } catch (error: any) {
    if (!error?.status) console.error(error);
    return toErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest, context: Params) {
  try {
    const params = await context.params;
    await requireMessagesAccess(params);
    const id = Number(request.nextUrl.searchParams.get("id"));
    if (!Number.isInteger(id)) throw createHttpError("\"id\" is required.", 400);
    await db.delete(formSubmissionTable).where(and(forSite(params.owner, params.repo), eq(formSubmissionTable.id, id)));
    return Response.json({ status: "success" });
  } catch (error: any) {
    if (!error?.status) console.error(error);
    return toErrorResponse(error);
  }
}
