import { breakdown } from "@/services/fees";
import type { EscrowLegDTO } from "@/contracts/offers";
import type { MockDb, MockMilestone, MockOffer, MockUser } from "@/lib/api/mock/types";

const FEE = { platformFeePercent: 10, processingReservePercent: 2 };
const AT = "2026-09-20T15:00:00.000Z";

type UserSpec = {
  id: string;
  name: string;
  email: string;
  headline: string;
  color: string;
  role: "Seller" | "Buyer" | "Both";
  guest?: boolean;
  kind?: "SEED" | "REVENUE";
  balance: number;
};

const USERS: UserSpec[] = [
  { id: "usr_maya", name: "Maya Chen", email: "maya@demo.test", headline: "Brand & identity designer", color: "#7C3AED", role: "Seller", balance: 500_000 },
  { id: "usr_leo", name: "Leo Okafor", email: "leo@demo.test", headline: "Full-stack developer", color: "#0F766E", role: "Seller", balance: 500_000 },
  { id: "usr_priya", name: "Priya Nair", email: "priya@demo.test", headline: "Content strategist & copywriter", color: "#B45309", role: "Seller", balance: 500_000 },
  { id: "usr_sam", name: "Sam Rivera", email: "sam@demo.test", headline: "Founder, Rivera Coffee Co.", color: "#0EA5E9", role: "Buyer", balance: 2_500_000 },
  { id: "usr_hannah", name: "Hannah Weiss", email: "hannah@demo.test", headline: "Marketing lead, Northwind", color: "#BE185D", role: "Buyer", balance: 2_500_000 },
  { id: "usr_diego", name: "Diego Alvarez", email: "diego@demo.test", headline: "Product manager, Lumen Apps", color: "#4338CA", role: "Buyer", balance: 2_500_000 },
  { id: "usr_aiko", name: "Aiko Tanaka", email: "aiko@demo.test", headline: "Motion designer", color: "#C2410C", role: "Both", balance: 2_500_000 },
  { id: "usr_omar", name: "Omar Haddad", email: "omar@demo.test", headline: "Indie game studio owner", color: "#334155", role: "Both", balance: 2_500_000 },
  { id: "usr_revenue", name: "Platform Revenue", email: "revenue@demo.test", headline: "Platform fee account", color: "#44403C", role: "Seller", guest: false, kind: "REVENUE", balance: 0 },
];

export const WELCOME_TEMPLATES = [
  {
    title: "Personal website",
    description: "A small site so you can try accepting, paying, and releasing a milestone.",
    milestones: [
      { title: "Wireframes", amount: "200.00" },
      { title: "Design", amount: "400.00" },
      { title: "Build", amount: "600.00" },
    ],
  },
  {
    title: "Logo design",
    description: "This offer was generated so you can try the flow.",
    milestones: [
      { title: "Concepts", amount: "250.00" },
      { title: "Final files", amount: "350.00" },
    ],
  },
  {
    title: "Pitch deck",
    description: "This offer was generated so you can try the flow.",
    milestones: [
      { title: "Outline", amount: "150.00" },
      { title: "Slides", amount: "450.00" },
    ],
  },
  {
    title: "Product explainer video",
    description: "This offer was generated so you can try the flow.",
    milestones: [
      { title: "Script", amount: "300.00" },
      { title: "Animation", amount: "900.00" },
    ],
  },
] as const;

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

function userFrom(spec: UserSpec): MockUser {
  const revenue = spec.kind === "REVENUE";
  return {
    id: spec.id,
    email: spec.email,
    password: "demo1234",
    name: spec.name,
    headline: spec.headline,
    avatarColor: spec.color,
    initials: initials(spec.name),
    kind: revenue ? "REVENUE" : "SEED",
    isGuestPool: !revenue,
    demoRole: revenue ? undefined : spec.role,
    airwallex: {
      accountId: `acct_mock_${spec.id.replace("usr_", "")}`,
      accountStatus: "ACTIVE",
    },
    provisioning: { step: "READY" },
    availableMinor: spec.balance,
    pendingMinor: 0,
    reservedMinor: 0,
  };
}

function milestone(
  offerId: string,
  index: number,
  title: string,
  dollars: number,
  status: MockMilestone["status"],
  extra: Partial<MockMilestone> = {},
): MockMilestone {
  const amountMinor = dollars * 100;
  const parts = breakdown(amountMinor, FEE);
  const id = `${offerId}_m${index}`;
  return {
    id,
    index,
    title,
    amountMinor,
    breakdown: parts,
    status,
    deliveries: [],
    escrowLegs: [],
    ...extra,
  };
}

function legs(id: string, sellerMinor: number, revenueMinor: number, status: string): EscrowLegDTO[] {
  return [
    {
      kind: "CA_TRANSFER",
      share: "SELLER",
      airwallexId: `tr_mock_${id}_seller`,
      amount: { amountMinor: sellerMinor, currency: "USD" },
      status,
    },
    {
      kind: "CA_TRANSFER",
      share: "REVENUE",
      airwallexId: `tr_mock_${id}_rev`,
      amount: { amountMinor: revenueMinor, currency: "USD" },
      status,
    },
  ];
}

function delivery(id: string, links: string[], note: string): MockMilestone["deliveries"][number] {
  return { id, links, note, submittedAt: "2026-09-24T16:00:00.000Z" };
}

function offer(input: {
  id: string;
  shortRef: string;
  seedKey: string;
  sellerId: string;
  buyerId: string;
  title: string;
  description: string;
  status: MockOffer["status"];
  fundingRail?: "CARD" | "WALLET";
  milestones: MockMilestone[];
  sentAt?: string;
}): MockOffer {
  return {
    ...input,
    sentAt: input.sentAt ?? AT,
    updatedAt: "2026-09-25T17:00:00.000Z",
    feeSnapshot: FEE,
    isWelcomeOffer: false,
    fundedAt: input.status === "SENT" ? undefined : "2026-09-22T12:00:00.000Z",
    completedAt: input.status === "COMPLETED" ? "2026-09-25T18:00:00.000Z" : undefined,
  };
}

export function createSeedDb(): MockDb {
  const users = USERS.map(userFrom);
  const coffee = "off_coffee";
  const social = "off_social";
  const shop = "off_shopify";
  const trailer = "off_trailer";
  const copy = "off_copy";
  const icon = "off_icon";

  const mood = milestone(coffee, 0, "Moodboard", 300, "PENDING_FUNDING");
  const logo = milestone(coffee, 1, "Logo", 700, "PENDING_FUNDING");
  const kit = milestone(coffee, 2, "Brand kit", 500, "PENDING_FUNDING");

  const setA = milestone(social, 0, "Set A", 400, "SUBMITTED", {
    deliveries: [delivery("del_social_a", ["https://www.figma.com/file/demo-templates"], "First set, see page 2")],
  });
  const setB = milestone(social, 1, "Set B", 400, "FUNDED");

  const audit = milestone(shop, 0, "Audit", 300, "PAID", {
    paidAt: "2026-09-23T15:00:00.000Z",
    deliveries: [delivery("del_audit", ["https://github.com/example/shopify-audit"], "Findings and the punch list")],
  });
  audit.escrowLegs = legs(audit.id, audit.breakdown.sellerMinor, audit.breakdown.revenueMinor, "SETTLED");
  const fixes = milestone(shop, 1, "Fixes", 900, "SUBMITTED", {
    deliveries: [delivery("del_fixes", ["https://github.com/example/shopify-fixes"], "Theme fixes are on the branch")],
  });

  const story = milestone(trailer, 0, "Storyboard", 600, "PAID", { paidAt: "2026-09-21T15:00:00.000Z" });
  story.escrowLegs = legs(story.id, story.breakdown.sellerMinor, story.breakdown.revenueMinor, "SETTLED");
  const animation = milestone(trailer, 1, "Animation", 1800, "FUNDED");
  const finalCut = milestone(trailer, 2, "Final cut", 600, "FUNDED");

  const pageCopy = milestone(copy, 0, "Copy", 350, "PAID", { paidAt: "2026-09-18T15:00:00.000Z" });
  pageCopy.escrowLegs = legs(pageCopy.id, pageCopy.breakdown.sellerMinor, pageCopy.breakdown.revenueMinor, "SETTLED");

  const appIcon = milestone(icon, 0, "Icon", 450, "REFUNDED", { refundedAt: "2026-09-19T15:00:00.000Z" });
  appIcon.escrowLegs = [
    {
      kind: "REFUND",
      share: "BUYER_REFUND",
      airwallexId: "rfd_mock_icon",
      amount: { amountMinor: appIcon.amountMinor, currency: "USD" },
      status: "SETTLED",
    },
  ];

  const offers: MockOffer[] = [
    offer({
      id: coffee,
      shortRef: "OF-7K2Q",
      seedKey: "coffee",
      sellerId: "usr_maya",
      buyerId: "usr_sam",
      title: "Coffee brand identity",
      description: "Full identity for Rivera Coffee Co.",
      status: "SENT",
      milestones: [mood, logo, kit],
    }),
    offer({
      id: "off_landing",
      shortRef: "OF-LAND",
      seedKey: "landing",
      sellerId: "usr_leo",
      buyerId: "usr_hannah",
      title: "Landing page build",
      description: "Design, build, and launch the Northwind landing page.",
      status: "SENT",
      milestones: [
        milestone("off_landing", 0, "Design", 800, "PENDING_FUNDING"),
        milestone("off_landing", 1, "Build", 1500, "PENDING_FUNDING"),
        milestone("off_landing", 2, "Launch", 400, "PENDING_FUNDING"),
      ],
    }),
    offer({
      id: "off_blog",
      shortRef: "OF-BLOG",
      seedKey: "blog",
      sellerId: "usr_priya",
      buyerId: "usr_diego",
      title: "Launch blog series",
      description: "Four posts for the Lumen Apps launch.",
      status: "SENT",
      milestones: [0, 1, 2, 3].map((index) => milestone("off_blog", index, `Post ${index + 1}`, 250, "PENDING_FUNDING")),
    }),
    offer({
      id: social,
      shortRef: "OF-SOCL",
      seedKey: "social",
      sellerId: "usr_maya",
      buyerId: "usr_hannah",
      title: "Social media templates",
      description: "Two template sets for Northwind.",
      status: "ACTIVE",
      fundingRail: "WALLET",
      milestones: [setA, setB],
    }),
    offer({
      id: shop,
      shortRef: "OF-SHOP",
      seedKey: "shopify",
      sellerId: "usr_leo",
      buyerId: "usr_sam",
      title: "Shopify store fixes",
      description: "Audit the theme, then fix the punch list.",
      status: "ACTIVE",
      fundingRail: "WALLET",
      milestones: [audit, fixes],
    }),
    offer({
      id: trailer,
      shortRef: "OF-TRLR",
      seedKey: "trailer",
      sellerId: "usr_aiko",
      buyerId: "usr_omar",
      title: "Game trailer",
      description: "Storyboard, animation, and the final cut.",
      status: "ACTIVE",
      fundingRail: "WALLET",
      milestones: [story, animation, finalCut],
    }),
    offer({
      id: "off_pixel",
      shortRef: "OF-PIXL",
      seedKey: "pixel",
      sellerId: "usr_omar",
      buyerId: "usr_aiko",
      title: "Pixel art asset pack",
      description: "Characters and tiles for the trailer world.",
      status: "SENT",
      milestones: [
        milestone("off_pixel", 0, "Characters", 500, "PENDING_FUNDING"),
        milestone("off_pixel", 1, "Tiles", 500, "PENDING_FUNDING"),
      ],
    }),
    offer({
      id: copy,
      shortRef: "OF-COPY",
      seedKey: "copy",
      sellerId: "usr_priya",
      buyerId: "usr_omar",
      title: "Store page copy",
      description: "Product page copy for the asset pack.",
      status: "COMPLETED",
      fundingRail: "WALLET",
      milestones: [pageCopy],
    }),
    offer({
      id: icon,
      shortRef: "OF-ICON",
      seedKey: "icon",
      sellerId: "usr_diego",
      buyerId: "usr_maya",
      title: "App icon refresh",
      description: "A new icon for Lumen Apps.",
      status: "CANCELLED",
      fundingRail: "WALLET",
      milestones: [appIcon],
    }),
  ];

  const find = (id: string) => {
    const user = users.find((item) => item.id === id);
    if (!user) throw new Error(`Missing seed user ${id}`);
    return user;
  };

  for (const item of offers) {
    if (!item.fundingRail) continue;
    const total = item.milestones.reduce((sum, entry) => sum + entry.amountMinor, 0);
    find(item.buyerId).availableMinor -= total;
    for (const entry of item.milestones) {
      if (entry.status === "PAID") {
        find(item.sellerId).availableMinor += entry.breakdown.sellerMinor;
        find("usr_revenue").availableMinor += entry.breakdown.revenueMinor;
      }
      if (entry.status === "REFUNDED") {
        find(item.buyerId).availableMinor += entry.amountMinor;
      }
    }
  }

  const transactions = users
    .filter((user) => user.kind !== "REVENUE")
    .map((user) => ({
      id: `txn_welcome_${user.id}`,
      userId: user.id,
      at: "2026-09-01T15:00:00.000Z",
      type: "DEPOSIT" as const,
      label: "Welcome credit",
      amount: { amountMinor: user.demoRole === "Seller" ? 500_000 : 2_500_000, currency: "USD" },
    }));

  return {
    users,
    offers,
    activity: [
      {
        id: "act_coffee",
        offerId: coffee,
        type: "OFFER_SENT",
        message: "Maya sent the offer",
        createdAt: AT,
      },
      {
        id: "act_social_delivery",
        offerId: social,
        type: "DELIVERY_SUBMITTED",
        message: "Maya submitted Set A",
        milestoneId: setA.id,
        createdAt: "2026-09-24T16:00:00.000Z",
      },
    ],
    events: [
      {
        id: "evt_social_charge",
        offerId: social,
        source: "API_CALL",
        at: "2026-09-22T12:00:00.000Z",
        method: "POST",
        path: "/api/v1/charges/create",
        status: 201,
        durationMs: 180,
        responseBody: { id: "ch_mock_social", status: "SETTLED" },
      },
      {
        id: "evt_social_webhook",
        offerId: social,
        source: "WEBHOOK",
        at: "2026-09-22T12:00:02.000Z",
        name: "charge.settled",
        objectId: "ch_mock_social",
        processed: true,
        payload: { id: "evt_mock_social", name: "charge.settled" },
      },
    ],
    transactions,
    sessionUserId: undefined,
    platformAvailableMinor: 5_000_000,
    scenario: "fresh-seed",
  };
}
