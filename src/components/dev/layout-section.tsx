import { DemoBanner } from "@/components/layout/demo-banner";
import { PageHeader } from "@/components/layout/page-header";
import { Section } from "@/components/layout/section";
import { TopBar } from "@/components/layout/top-bar";
import { Button } from "@/components/ui/button";
import { KitSection, Variant } from "@/components/dev/kit-section";
import { sampleBalance, seedUser } from "@/components/dev/kit-fixtures";

const maya = seedUser("usr_maya");

export function LayoutSection() {
  return (
    <>
      <KitSection id="app-shell" title="AppShell" note="Compact banner above the top bar, then the content column. Redirects stay off on this page.">
        <Variant caption="AppShell / preview" className="@min-[720px]:col-span-2">
          <div className="overflow-visible rounded-md border border-border bg-surface pb-8">
            <DemoBanner variant="mock" dismissible={false} />
            <TopBar user={maya} balance={sampleBalance} showUiKit pinned={false} onLogout={() => undefined} />
            <div className="px-6 py-6 pt-10">
              <PageHeader title="Hi Maya" subtitle="Your offers" />
            </div>
          </div>
        </Variant>
      </KitSection>
      <KitSection id="top-bar" title="TopBar" note="One row, with the Airwallex notch on the bottom edge. Below md a menu button opens the side panel.">
        <Variant caption="TopBar / signed in" className="@min-[720px]:col-span-2">
          <TopBar user={maya} balance={sampleBalance} showUiKit pinned={false} onLogout={() => undefined} />
        </Variant>
        <Variant caption="TopBar / balance loading" className="@min-[720px]:col-span-2">
          <TopBar user={maya} balanceLoading pinned={false} onLogout={() => undefined} />
        </Variant>
      </KitSection>
      <KitSection id="demo-banner" title="DemoBanner" note="Compact strip above the top bar. Sandbox, guest, and mock-data notices.">
        <Variant caption="DemoBanner / sandbox" className="@min-[720px]:col-span-2">
          <DemoBanner variant="sandbox" dismissible={false} />
        </Variant>
        <Variant caption="DemoBanner / guest" className="@min-[720px]:col-span-2">
          <DemoBanner variant="guest" dismissible={false} />
        </Variant>
        <Variant caption="DemoBanner / mock" className="@min-[720px]:col-span-2">
          <DemoBanner variant="mock" dismissible={false} />
        </Variant>
      </KitSection>
      <KitSection id="page-header" title="PageHeader" note="Title, subtitle, back link, and actions.">
        <Variant caption="PageHeader / with actions" className="@min-[720px]:col-span-2">
          <PageHeader title="Coffee brand identity" subtitle="OF-7K2Q" backHref="#page-header" backLabel="Offers" actions={<Button type="button">Accept & pay</Button>} />
        </Variant>
      </KitSection>
      <KitSection id="section" title="Section" note="A titled group with a count and an action.">
        <Variant caption="Section / with count" className="@min-[720px]:col-span-2">
          <Section title="Incoming" count={2} action={<Button type="button" variant="outline" size="sm">New offer</Button>}>
            <p className="text-sm text-muted-foreground">Offer cards sit here.</p>
          </Section>
        </Variant>
      </KitSection>
    </>
  );
}
