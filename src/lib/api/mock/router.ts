export type MockCtx = {
  params: Record<string, string>;
  body?: unknown;
  query?: Record<string, string | undefined>;
};

type Route = {
  method: "GET" | "POST";
  pattern: string;
  handler: (ctx: MockCtx) => unknown | Promise<unknown>;
};

export function createRouter(routes: Route[]) {
  return function match(method: "GET" | "POST", path: string) {
    const pathname = path.split("?")[0] ?? path;
    const actual = pathname.split("/");
    for (const route of routes) {
      if (route.method !== method) continue;
      const expected = route.pattern.split("/");
      if (expected.length !== actual.length) continue;
      const params: Record<string, string> = {};
      let ok = true;
      for (let index = 0; index < expected.length; index += 1) {
        const token = expected[index] ?? "";
        const value = actual[index] ?? "";
        if (token.startsWith(":")) params[token.slice(1)] = decodeURIComponent(value);
        else if (token !== value) ok = false;
      }
      if (ok) return { handler: route.handler, params };
    }
    return undefined;
  };
}

export type { Route };
