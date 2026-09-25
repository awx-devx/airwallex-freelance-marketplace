import type { ZodType } from "zod";
import { publicConfig } from "@/lib/config.public";
import { httpTransport } from "@/lib/api/http";

export interface Transport {
  request<T>(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
    query?: Record<string, string | undefined>,
  ): Promise<T>;
}

let mockTransport: Promise<Transport> | undefined;

export function getTransport(): Promise<Transport> {
  if (!publicConfig.apiMocks) return Promise.resolve(httpTransport);
  mockTransport ??= import("@/lib/api/mock").then((mod) => mod.mockTransport);
  return mockTransport;
}

export async function request<T>(
  method: "GET" | "POST",
  path: string,
  body?: unknown,
  query?: Record<string, string | undefined>,
  schema?: ZodType<T>,
): Promise<T> {
  const transport = await getTransport();
  const data = await transport.request<T>(method, path, body, query);
  if (process.env.NODE_ENV !== "production" && schema) {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      console.warn(`[api] ${method} ${path} did not match the contract`, parsed.error.issues);
    }
  }
  return data;
}
