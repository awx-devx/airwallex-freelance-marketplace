export type SeedMilestoneSpec = {
  title: string;
  /** Major-unit amount, e.g. "300.00". */
  amount: string;
  links?: string[];
  then?: "approve" | "refund";
};

export type SeedOfferSpec = {
  seedKey: string;
  sellerEmail: string;
  buyerEmail: string;
  title: string;
  description: string;
  milestones: SeedMilestoneSpec[];
};

/** docs/08 offer table. Non-SENT rows are funded on the wallet rail by scripts/seed-offers.ts. */
export const SEED_OFFERS: SeedOfferSpec[] = [
  {
    seedKey: "coffee",
    sellerEmail: "maya@demo.test",
    buyerEmail: "sam@demo.test",
    title: "Coffee brand identity",
    description: "A brand system for Rivera Coffee Co., from moodboard through a working kit.",
    milestones: [
      { title: "Moodboard", amount: "300.00" },
      { title: "Logo", amount: "700.00" },
      { title: "Brand kit", amount: "500.00" },
    ],
  },
  {
    seedKey: "landing",
    sellerEmail: "leo@demo.test",
    buyerEmail: "hannah@demo.test",
    title: "Landing page build",
    description: "Design, build, and launch a marketing page for Northwind.",
    milestones: [
      { title: "Design", amount: "800.00" },
      { title: "Build", amount: "1500.00" },
      { title: "Launch", amount: "400.00" },
    ],
  },
  {
    seedKey: "blog",
    sellerEmail: "priya@demo.test",
    buyerEmail: "diego@demo.test",
    title: "Launch blog series",
    description: "Four launch posts for Lumen Apps.",
    milestones: [
      { title: "Post 1", amount: "250.00" },
      { title: "Post 2", amount: "250.00" },
      { title: "Post 3", amount: "250.00" },
      { title: "Post 4", amount: "250.00" },
    ],
  },
  {
    seedKey: "social",
    sellerEmail: "maya@demo.test",
    buyerEmail: "hannah@demo.test",
    title: "Social media templates",
    description: "Two template sets for Northwind's social channels.",
    milestones: [
      { title: "Set A", amount: "400.00", links: ["https://www.figma.com/file/demo-social-set-a"] },
      { title: "Set B", amount: "400.00" },
    ],
  },
  {
    seedKey: "shopify",
    sellerEmail: "leo@demo.test",
    buyerEmail: "sam@demo.test",
    title: "Shopify store fixes",
    description: "Audit Rivera Coffee's store, then apply the fixes.",
    milestones: [
      { title: "Audit", amount: "300.00", links: ["https://www.figma.com/file/demo-shopify-audit"], then: "approve" },
      { title: "Fixes", amount: "900.00", links: ["https://www.figma.com/file/demo-shopify-fixes"] },
    ],
  },
  {
    seedKey: "trailer",
    sellerEmail: "aiko@demo.test",
    buyerEmail: "omar@demo.test",
    title: "Game trailer",
    description: "Storyboard, animation, and a final cut for the studio trailer.",
    milestones: [
      { title: "Storyboard", amount: "600.00", links: ["https://www.figma.com/file/demo-trailer-storyboard"], then: "approve" },
      { title: "Animation", amount: "1800.00" },
      { title: "Final cut", amount: "600.00" },
    ],
  },
  {
    seedKey: "pixel",
    sellerEmail: "omar@demo.test",
    buyerEmail: "aiko@demo.test",
    title: "Pixel art asset pack",
    description: "Character and tile sets for an indie game.",
    milestones: [
      { title: "Characters", amount: "500.00" },
      { title: "Tiles", amount: "500.00" },
    ],
  },
  {
    seedKey: "copy",
    sellerEmail: "priya@demo.test",
    buyerEmail: "omar@demo.test",
    title: "Store page copy",
    description: "Product-page copy for the studio store.",
    milestones: [{ title: "Copy", amount: "350.00", links: ["https://www.figma.com/file/demo-store-copy"], then: "approve" }],
  },
  {
    seedKey: "icon",
    sellerEmail: "diego@demo.test",
    buyerEmail: "maya@demo.test",
    title: "App icon refresh",
    description: "A refreshed app icon, cancelled after funding.",
    milestones: [{ title: "Icon", amount: "450.00", then: "refund" }],
  },
];
