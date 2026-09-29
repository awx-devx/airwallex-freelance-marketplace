import type { ZodType } from "zod";
import type { UserDocument } from "@/models/user";
import { readSession } from "@/lib/session";
import { requireUser } from "@/services/auth";
import { Forbidden, HttpError, Unauthenticated, toErrorResponse, validationFailed } from "@/server/errors";

type RouteParams = { params?: Promise<Record<string, string>> };

type HandlerContext<TBody, TQuery> = {
  request: Request;
  params: Record<string, string>;
  body: TBody;
  query: TQuery;
  user: UserDocument;
  guest: boolean;
};

type PublicHandlerContext<TBody, TQuery> = Omit<HandlerContext<TBody, TQuery>, "user" | "guest">;

type RouteOptions<TBody, TQuery> = {
  body?: ZodType<TBody>;
  query?: ZodType<TQuery>;
  successStatus?: number;
};

// DEMO-ONLY: No rate limit, lockout, or email verification. SameSite=Lax plus this same-origin check is the CSRF bar.
// PROD: Add rate limiting, lockout, verified email, and a CSRF token or double-submit cookie.
function assertSameOrigin(request: Request): void {
  if (request.method === "GET" || request.method === "HEAD") return;
  const origin = request.headers.get("origin");
  if (!origin) return;
  // request.url is the internal host behind a tunnel/proxy; match Origin to the
  // public Host the browser used so CSRF still fails (Origin ≠ Host) but
  // cloudflared / ngrok same-site posts succeed.
  if (origin === new URL(request.url).origin) return;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (host && new URL(origin).host === host) return;
  throw new Forbidden("Cross-origin requests are refused.");
}

async function parseBody<T>(request: Request, schema?: ZodType<T>): Promise<T> {
  if (!schema) return undefined as T;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new HttpError(422, "VALIDATION_FAILED", "Request body must be JSON.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) throw validationFailed(parsed.error);
  return parsed.data;
}

function parseQuery<T>(request: Request, schema?: ZodType<T>): T {
  if (!schema) return undefined as T;
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!parsed.success) throw validationFailed(parsed.error);
  return parsed.data;
}

async function execute<TBody, TQuery>(
  request: Request,
  context: RouteParams | undefined,
  options: RouteOptions<TBody, TQuery>,
  handler: (ctx: PublicHandlerContext<TBody, TQuery>) => Promise<unknown>,
): Promise<Response> {
  try {
    assertSameOrigin(request);
    const params = context?.params ? await context.params : {};
    const body = await parseBody(request, options.body);
    const query = parseQuery(request, options.query);
    const result = await handler({ request, params, body, query });
    return Response.json(result, { status: options.successStatus ?? 200 });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export function route<TBody = undefined, TQuery = undefined>(
  options: RouteOptions<TBody, TQuery>,
  handler: (ctx: HandlerContext<TBody, TQuery>) => Promise<unknown>,
) {
  return (request: Request, context?: RouteParams) =>
    execute(request, context, options, async (ctx) => {
      const session = await readSession();
      if (!session) throw new Unauthenticated();
      const user = await requireUser(session.userId);
      return handler({ ...ctx, user, guest: session.guest });
    });
}

export function publicRoute<TBody = undefined, TQuery = undefined>(
  options: RouteOptions<TBody, TQuery>,
  handler: (ctx: PublicHandlerContext<TBody, TQuery>) => Promise<unknown>,
) {
  return (request: Request, context?: RouteParams) => execute(request, context, options, handler);
}
