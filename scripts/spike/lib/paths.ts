import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const libDir = dirname(fileURLToPath(import.meta.url));

export const spikeRoot = dirname(libDir);
export const outDir = join(spikeRoot, "out");
export const findingsPath = join(spikeRoot, "FINDINGS.md");
export const checkoutHtmlPath = join(spikeRoot, "checkout.html");
