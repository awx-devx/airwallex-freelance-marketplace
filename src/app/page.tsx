export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium text-primary">Sandbox demo</p>
      <h1 className="mt-2 font-serif text-4xl font-medium tracking-tight">Freelance escrow</h1>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Milestone payments stay held until the buyer approves. Screens land in later phases.
      </p>
    </main>
  );
}
