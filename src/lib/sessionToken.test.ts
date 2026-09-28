/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { signSessionToken, verifySessionToken } from "@/lib/sessionToken";

const secret = "s".repeat(40);

describe("session tokens", () => {
  it("round-trips the user id and guest flag", async () => {
    const token = await signSessionToken({ userId: "abc", guest: true }, secret);
    await expect(verifySessionToken(token, secret)).resolves.toEqual({ userId: "abc", guest: true });
  });

  it("rejects a token signed with a different secret", async () => {
    const token = await signSessionToken({ userId: "abc", guest: false }, secret);
    await expect(verifySessionToken(token, "t".repeat(40))).rejects.toThrow();
  });
});
