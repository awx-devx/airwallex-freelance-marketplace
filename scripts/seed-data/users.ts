export type SeedRole = "Seller" | "Buyer" | "Both";

export type SeedUserSpec = {
  name: string;
  email: string;
  headline: string;
  avatarColor: string;
  role: SeedRole;
  /** Extra CA transfer on top of the welcome credit, in major units. Buyers need it for wallet-rail demos. */
  extraTopUpMajor: number;
};

export const SEED_VERSION_START = 1;
export const BUYER_EXTRA_TOP_UP_MAJOR = 20_000;

export const SEED_USERS: SeedUserSpec[] = [
  { name: "Maya Chen", email: "maya@demo.test", headline: "Brand & identity designer", avatarColor: "#7C3AED", role: "Seller", extraTopUpMajor: 0 },
  { name: "Leo Okafor", email: "leo@demo.test", headline: "Full-stack developer", avatarColor: "#0F766E", role: "Seller", extraTopUpMajor: 0 },
  { name: "Priya Nair", email: "priya@demo.test", headline: "Content strategist & copywriter", avatarColor: "#B45309", role: "Seller", extraTopUpMajor: 0 },
  { name: "Sam Rivera", email: "sam@demo.test", headline: "Founder, Rivera Coffee Co.", avatarColor: "#0EA5E9", role: "Buyer", extraTopUpMajor: BUYER_EXTRA_TOP_UP_MAJOR },
  { name: "Hannah Weiss", email: "hannah@demo.test", headline: "Marketing lead, Northwind", avatarColor: "#BE185D", role: "Buyer", extraTopUpMajor: BUYER_EXTRA_TOP_UP_MAJOR },
  { name: "Diego Alvarez", email: "diego@demo.test", headline: "Product manager, Lumen Apps", avatarColor: "#4338CA", role: "Buyer", extraTopUpMajor: BUYER_EXTRA_TOP_UP_MAJOR },
  { name: "Aiko Tanaka", email: "aiko@demo.test", headline: "Motion designer", avatarColor: "#C2410C", role: "Both", extraTopUpMajor: BUYER_EXTRA_TOP_UP_MAJOR },
  { name: "Omar Haddad", email: "omar@demo.test", headline: "Indie game studio owner", avatarColor: "#334155", role: "Both", extraTopUpMajor: BUYER_EXTRA_TOP_UP_MAJOR },
];

export const REVENUE_USER = {
  name: "Platform Revenue",
  email: "revenue@demo.test",
  headline: "Platform fee account",
  avatarColor: "#44403C",
  identifier: "revenue",
};

export function seedIdentifier(email: string, seedVersion: number): string {
  const slug = email.split("@")[0] ?? email;
  return seedVersion <= 1 ? `seed-${slug}` : `seed-${slug}-v${seedVersion}`;
}
