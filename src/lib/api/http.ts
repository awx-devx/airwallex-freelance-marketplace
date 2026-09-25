import { ErrorSchema } from "@/contracts/common";
import { ApiError } from "@/lib/api/errors";
import type { Transport } from "@/lib/api/transport";

function withQuery(path: string, query?: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) params.set(key, value);
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

export const httpTransport: Transport = {
  async request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    query?: Record<string, string | undefined>,
  ): Promise<T> {
    let response: Response;
    try {
      response = await fetch(withQuery(path, query), {
        method,
        credentials: "same-origin",
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
    } catch {
      throw new ApiError({ status: 0, code: "NETWORK", message: "Network request failed." });
    }

    const text = await response.text();
    const json: unknown = text ? JSON.parse(text) : null;
    if (!response.ok) {
      const parsed = ErrorSchema.safeParse(json);
      if (parsed.success) {
        throw new ApiError({ status: response.status, ...parsed.data.error });
      }
      throw new ApiError({
        status: response.status,
        code: "INTERNAL",
        message: response.statusText || "Request failed.",
      });
    }
    return json as T;
  },
};
