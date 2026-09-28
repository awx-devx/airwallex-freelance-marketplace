export type WelcomeTemplate = {
  title: string;
  description: string;
  milestones: Array<{ title: string; amount: string }>;
};

export const WELCOME_TEMPLATES: WelcomeTemplate[] = [
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
];
