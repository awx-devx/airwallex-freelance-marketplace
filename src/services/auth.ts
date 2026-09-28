import { compare, hash } from "bcryptjs";
import { Types } from "mongoose";
import type { LoginInput, SignupInput } from "@/contracts/users";
import { connectDb } from "@/lib/db";
import { User, type UserDocument } from "@/models/user";
import { toDemoAccount, toMe, toUserSummary } from "@/server/dto/users";
import { EmailTaken, HttpError, InvalidCredentials, Unauthenticated } from "@/server/errors";

const BCRYPT_COST = 10;
const DUMMY_PASSWORD_HASH = "$2b$10$M8lgHRzasoPvucYG3bFJQe65QLJF6X079PlgXiY9q3dS1TzNOALC6";
const SIGNUP_AVATAR_COLOR = "#57534E";

function duplicateKey(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && (error as { code: unknown }).code === 11000;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function requireUser(userId: string): Promise<UserDocument> {
  await connectDb();
  if (!Types.ObjectId.isValid(userId)) throw new Unauthenticated();
  const user = await User.findById(userId);
  if (!user || user.kind === "REVENUE") throw new Unauthenticated();
  return user;
}

export async function signup(input: SignupInput) {
  await connectDb();
  const email = input.email.toLowerCase();
  const passwordHash = await hash(input.password, BCRYPT_COST);
  try {
    const user = await User.create({
      email,
      passwordHash,
      name: input.name.trim(),
      headline: input.headline?.trim() || undefined,
      avatarColor: SIGNUP_AVATAR_COLOR,
      kind: "REGULAR",
      isGuestPool: false,
      airwallex: { provisioning: { step: "NONE", updatedAt: new Date() } },
    });
    return toMe(user, false);
  } catch (error) {
    if (duplicateKey(error)) throw new EmailTaken();
    throw error;
  }
}

export async function login(input: LoginInput) {
  await connectDb();
  const user = await User.findOne({ email: input.email.toLowerCase(), kind: { $ne: "REVENUE" } });
  const matches = await compare(input.password, user?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!user || !matches) throw new InvalidCredentials();
  return toMe(user, false);
}

export async function guestLogin() {
  await connectDb();
  // DEMO-ONLY: Guests share seed accounts, so concurrent visitors see each other's actions.
  // PROD: No shared accounts; per-user sessions only.
  const filter = { isGuestPool: true, kind: "SEED" as const, "airwallex.provisioning.step": "READY" };
  const count = await User.countDocuments(filter);
  if (count === 0) throw new HttpError(500, "INTERNAL", "No guest accounts are ready.");
  const user = await User.findOne(filter).skip(Math.floor(Math.random() * count));
  if (!user || user.kind !== "SEED") throw new HttpError(500, "INTERNAL", "No guest accounts are ready.");
  return toMe(user, true);
}

export async function listDemoAccounts() {
  await connectDb();
  const users = await User.find({ kind: "SEED", demoRole: { $exists: true } }).sort({ name: 1 });
  return users.filter((user) => user.demoRole).map((user) => toDemoAccount(user));
}

export async function searchUsers(actorId: string, q: string) {
  await connectDb();
  const needle = q.trim().toLowerCase();
  const pattern = new RegExp(escapeRegex(needle), "i");
  const users = await User.find({
    _id: { $ne: actorId },
    kind: { $ne: "REVENUE" },
    "airwallex.provisioning.step": "READY",
    $or: [{ name: pattern }, { email: pattern }],
  })
    .sort({ name: 1 })
    .limit(10);
  return users.map((user) => toUserSummary(user));
}
