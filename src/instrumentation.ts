export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { getServerConfig } = await import("@/lib/config");
  getServerConfig();
}
