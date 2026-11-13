import { getAuth } from "@/lib/auth";

const handle = async (request: Request) => (await getAuth()).handler(request);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
