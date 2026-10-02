"use client";

import type { OfferAction, ViewerRole } from "@/contracts/offers";
import { AccountCard } from "@/components/domain/account-card";
import { ActivityTimeline } from "@/components/domain/activity-timeline";
import { AirwallexActivityPanel } from "@/components/domain/airwallex-activity-panel";
import { BalanceTable } from "@/components/domain/balance-table";
import { DeliveryForm } from "@/components/domain/delivery-form";
import { DeliveryView } from "@/components/domain/delivery-view";
import { DropInCheckout } from "@/components/domain/drop-in-checkout";
import { ReleaseLegList } from "@/components/domain/release-leg-list";
import { ReleaseSummary } from "@/components/domain/release-summary";
import { FeeBreakdown, resolveFeeBreakdown } from "@/components/domain/fee-breakdown";
import { MilestoneCard } from "@/components/domain/milestone-card";
import { MilestoneEditor } from "@/components/domain/milestone-editor";
import { MockCardForm } from "@/components/domain/mock-card-form";
import { Money } from "@/components/domain/money";
import { OfferActionBar } from "@/components/domain/offer-action-bar";
import { OfferCard } from "@/components/domain/offer-card";
import { OfferHeader } from "@/components/domain/offer-header";
import { ProvisioningChecklist } from "@/components/domain/provisioning-checklist";
import { ReviewActions } from "@/components/domain/review-actions";
import { StatusPill } from "@/components/domain/status-pill";
import { statusVisual, type AnyStatus } from "@/components/domain/status";
import { TestCardHint } from "@/components/domain/test-card-hint";
import { TransactionList } from "@/components/domain/transaction-list";
import { UserChip } from "@/components/domain/user-chip";
import { UserPicker } from "@/components/domain/user-picker";
import { WalletChip } from "@/components/domain/wallet-chip";
import { KitSection, Variant } from "@/components/dev/kit-section";
import {
  MILESTONE_STATUSES,
  legSamples,
  milestoneFor,
  offerHeaders,
  payeeName,
  provisioningSteps,
  sampleActivity,
  sampleBalance,
  sampleEvents,
  sampleTransactions,
  seedOffer,
  seedSummary,
  seedUser,
  testCards,
  welcomeOffer,
} from "@/components/dev/kit-fixtures";
import { money } from "@/lib/api/mock/present";

const ALL_STATUSES: AnyStatus[] = [
  "SENT",
  "PENDING_FUNDING",
  "AWAITING_PAYMENT",
  "ACTIVE",
  "FUNDED",
  "SUBMITTED",
  "CHANGES_REQUESTED",
  "RELEASING",
  "PAID",
  "COMPLETED",
  "REFUNDING",
  "REFUNDED",
  "CANCELLED",
  "DECLINED",
  "WITHDRAWN",
  "RELEASE_FAILED",
  "REFUND_FAILED",
];

const ACTION_SETS: OfferAction[][] = [
  ["ACCEPT_AND_PAY", "DECLINE"],
  ["WITHDRAW"],
  ["CONTINUE_PAYMENT", "CANCEL_PAYMENT"],
  ["CANCEL_REMAINING"],
  [],
];

const feeExamples = [
  { caption: "FeeBreakdown / $1,000", amountMinor: 100_000, platformFeePercent: 10, processingReservePercent: 2 },
  { caption: "FeeBreakdown / $10 minimum", amountMinor: 1_000, platformFeePercent: 10, processingReservePercent: 2 },
  { caption: "FeeBreakdown / $333.33 rounding", amountMinor: 33_333, platformFeePercent: 10, processingReservePercent: 2 },
  { caption: "FeeBreakdown / zero reserve", amountMinor: 100_000, platformFeePercent: 10, processingReservePercent: 0 },
];

const delivery = {
  id: "del_kit",
  links: ["https://www.figma.com/file/demo-templates"],
  note: "First set, see page 2.",
  submittedAt: "2026-09-24T16:00:00.000Z",
};

export function DomainSection({ viewerRole }: { viewerRole: ViewerRole }) {
  const maya = seedUser("usr_maya");
  const social = seedOffer("off_social", "usr_hannah");
  const headers = offerHeaders(viewerRole);

  return (
    <>
      <KitSection id="money" title="Money" note="Newsreader amounts. Signed values keep their sign.">
        <Variant caption="Money / positive">
          <Money value={money(125_000)} />
        </Variant>
        <Variant caption="Money / negative signed">
          <Money value={money(-1_250)} signed />
        </Variant>
        <Variant caption="Money / zero">
          <Money value={money(0)} />
        </Variant>
        <Variant caption="Money / large">
          <Money value={money(2_500_000)} size="lg" />
        </Variant>
      </KitSection>

      <KitSection id="status-pill" title="StatusPill" note="One pill per offer and milestone status.">
        {ALL_STATUSES.map((status) => (
          <Variant key={status} caption={`StatusPill / ${statusVisual(status).label}`}>
            <StatusPill status={status} />
          </Variant>
        ))}
      </KitSection>

      <KitSection id="user-chip" title="UserChip" note="Avatar, name, and an optional headline.">
        <Variant caption="UserChip / with headline">
          <UserChip user={maya} />
        </Variant>
        <Variant caption="UserChip / name only">
          <UserChip user={{ ...maya, headline: undefined }} />
        </Variant>
      </KitSection>

      <KitSection id="wallet-chip" title="WalletChip" note="Available balance, a loading skeleton, or a dash.">
        <Variant caption="WalletChip / value">
          <WalletChip balance={sampleBalance} />
        </Variant>
        <Variant caption="WalletChip / loading">
          <WalletChip loading />
        </Variant>
        <Variant caption="WalletChip / error">
          <WalletChip error />
        </Variant>
      </KitSection>

      <KitSection id="fee-breakdown" title="FeeBreakdown" note="Seller, fee, and reserve. Inline, card, and tooltip.">
        {feeExamples.map((example) => (
          <Variant key={example.caption} caption={`${example.caption} / card`}>
            <FeeBreakdown variant="card" value={resolveFeeBreakdown(example)} />
          </Variant>
        ))}
        <Variant caption="FeeBreakdown / inline">
          <FeeBreakdown variant="inline" value={resolveFeeBreakdown(feeExamples[0]!)} />
        </Variant>
        <Variant caption="FeeBreakdown / tooltip">
          <FeeBreakdown variant="tooltip" value={resolveFeeBreakdown(feeExamples[0]!)} />
        </Variant>
      </KitSection>

      <KitSection id="offer-card" title="OfferCard" note="Incoming, active, selling, completed, cancelled, and a welcome offer.">
        <Variant caption="OfferCard / incoming">
          <OfferCard offer={seedSummary("off_coffee", "usr_sam")} />
        </Variant>
        <Variant caption="OfferCard / buying active">
          <OfferCard offer={seedSummary("off_social", "usr_hannah")} />
        </Variant>
        <Variant caption="OfferCard / selling">
          <OfferCard offer={seedSummary("off_social", "usr_maya")} />
        </Variant>
        <Variant caption="OfferCard / completed">
          <OfferCard offer={seedSummary("off_copy", "usr_omar")} />
        </Variant>
        <Variant caption="OfferCard / cancelled">
          <OfferCard offer={seedSummary("off_icon", "usr_maya")} />
        </Variant>
        <Variant caption="OfferCard / welcome">
          <OfferCard offer={welcomeOffer} />
        </Variant>
      </KitSection>

      <KitSection id="offer-header" title="OfferHeader" note={`Each offer status, as the ${viewerRole}.`}>
        {headers.map((offer) => (
          <Variant key={offer.status} caption={`OfferHeader / ${offer.status} / ${viewerRole}`} className="@min-[720px]:col-span-2">
            <OfferHeader offer={offer} />
          </Variant>
        ))}
      </KitSection>

      <KitSection id="offer-action-bar" title="OfferActionBar" note="Each allowed-action combination.">
        {ACTION_SETS.map((allowedActions) => (
          <Variant key={allowedActions.join("-") || "none"} caption={`OfferActionBar / ${allowedActions.join(", ") || "none"}`}>
            <OfferActionBar offer={{ allowedActions }} />
          </Variant>
        ))}
      </KitSection>

      <KitSection id="release-summary" title="ReleaseSummary" note="Held, partly released, refunded, and completed.">
        <Variant caption="ReleaseSummary / all held">
          <ReleaseSummary totals={seedOffer("off_social", "usr_hannah").totals} />
        </Variant>
        <Variant caption="ReleaseSummary / partly released">
          <ReleaseSummary totals={seedOffer("off_shopify", "usr_sam").totals} />
        </Variant>
        <Variant caption="ReleaseSummary / refunded">
          <ReleaseSummary totals={seedOffer("off_icon", "usr_maya").totals} />
        </Variant>
        <Variant caption="ReleaseSummary / completed">
          <ReleaseSummary totals={seedOffer("off_copy", "usr_omar").totals} />
        </Variant>
      </KitSection>

      <KitSection id="milestone-card" title="MilestoneCard" note="Every milestone status for the buyer and the seller.">
        {(["BUYER", "SELLER"] as const).flatMap((role) =>
          MILESTONE_STATUSES.map((status) => (
            <Variant key={`${role}-${status}`} caption={`MilestoneCard / ${status} / ${role}`} className="@min-[720px]:col-span-2">
              <MilestoneCard
                milestone={milestoneFor(status, role)}
                payeeName={payeeName}
                buyerName={social.buyer.name}
                viewerRole={role}
                fundingRail={social.fundingRail}
              />
            </Variant>
          )),
        )}
        <Variant caption="MilestoneCard / releasing stuck / retry" className="@min-[720px]:col-span-2">
          <MilestoneCard
            milestone={milestoneFor("RELEASING", "BUYER", { lastError: "Timed out waiting for funds_split.settled" })}
            payeeName={payeeName}
            buyerName={social.buyer.name}
            viewerRole="BUYER"
            fundingRail={social.fundingRail}
          />
        </Variant>
        <Variant caption="MilestoneCard / still waiting" className="@min-[720px]:col-span-2">
          <MilestoneCard
            milestone={milestoneFor("RELEASING", "BUYER")}
            payeeName={payeeName}
            buyerName={social.buyer.name}
            viewerRole="BUYER"
            fundingRail={social.fundingRail}
            timedOut
          />
        </Variant>
      </KitSection>

      <KitSection id="delivery-form" title="DeliveryForm" note="Empty, one link, five links, an invalid URL, and submitting.">
        <Variant caption="DeliveryForm / empty">
          <DeliveryForm />
        </Variant>
        <Variant caption="DeliveryForm / 1 link">
          <DeliveryForm defaultLinks={["https://www.figma.com/file/demo"]} />
        </Variant>
        <Variant caption="DeliveryForm / 5 links">
          <DeliveryForm defaultLinks={[1, 2, 3, 4, 5].map((n) => `https://example.com/file-${n}`)} />
        </Variant>
        <Variant caption="DeliveryForm / invalid URL">
          <DeliveryForm defaultLinks={["notaurl"]} error="Enter an http(s) URL." />
        </Variant>
        <Variant caption="DeliveryForm / submitting">
          <DeliveryForm defaultLinks={["https://example.com/final"]} submitting />
        </Variant>
      </KitSection>

      <KitSection id="delivery-view" title="DeliveryView" note="With a note, without a note, and with a review comment.">
        <Variant caption="DeliveryView / with note">
          <DeliveryView delivery={delivery} />
        </Variant>
        <Variant caption="DeliveryView / without note">
          <DeliveryView delivery={{ ...delivery, note: undefined }} />
        </Variant>
        <Variant caption="DeliveryView / review comment">
          <DeliveryView
            delivery={{
              ...delivery,
              review: { decision: "CHANGES_REQUESTED", comment: "Please export the source files.", reviewedAt: "2026-09-24T18:00:00.000Z" },
            }}
          />
        </Variant>
      </KitSection>

      <KitSection id="review-actions" title="ReviewActions" note="Idle, approving, and the request-changes dialog.">
        <Variant caption="ReviewActions / idle">
          <ReviewActions amount={money(40_000)} />
        </Variant>
        <Variant caption="ReviewActions / approving">
          <ReviewActions amount={money(40_000)} approving />
        </Variant>
        <Variant caption="ReviewActions / open the dialog from Request changes">
          <ReviewActions amount={money(40_000)} />
        </Variant>
      </KitSection>

      <KitSection id="release-leg-list" title="ReleaseLegList" note="A funds split, a transfer, and a refund.">
        <Variant caption="ReleaseLegList / split, transfer, refund" className="@min-[720px]:col-span-2">
          <ReleaseLegList legs={legSamples} />
        </Variant>
      </KitSection>

      <KitSection id="activity-timeline" title="ActivityTimeline" note="Empty, and a short offer history.">
        <Variant caption="ActivityTimeline / empty">
          <ActivityTimeline items={[]} />
        </Variant>
        <Variant caption="ActivityTimeline / history">
          <ActivityTimeline items={sampleActivity} />
        </Variant>
      </KitSection>

      <KitSection id="airwallex-activity" title="AirwallexActivityPanel" note="Collapsed, expanded, API calls, webhooks, and JSON.">
        <Variant caption="AirwallexActivityPanel / collapsed" className="@min-[720px]:col-span-2">
          <AirwallexActivityPanel events={sampleEvents} />
        </Variant>
        <Variant caption="AirwallexActivityPanel / expanded" className="@min-[720px]:col-span-2">
          <AirwallexActivityPanel events={sampleEvents} defaultOpen />
        </Variant>
      </KitSection>

      <KitSection id="balance-table" title="BalanceTable" note="One currency, loading, and empty.">
        <Variant caption="BalanceTable / one currency" className="@min-[720px]:col-span-2">
          <BalanceTable balances={[sampleBalance]} />
        </Variant>
        <Variant caption="BalanceTable / loading">
          <BalanceTable loading />
        </Variant>
        <Variant caption="BalanceTable / empty">
          <BalanceTable balances={[]} />
        </Variant>
      </KitSection>

      <KitSection id="transaction-list" title="TransactionList" note="Inflow, outflow, load more, and empty.">
        <Variant caption="TransactionList / rows and load more">
          <TransactionList items={sampleTransactions} hasMore />
        </Variant>
        <Variant caption="TransactionList / empty">
          <TransactionList items={[]} />
        </Variant>
      </KitSection>

      <KitSection id="account-card" title="AccountCard" note="An active account, and one that needs action.">
        <Variant caption="AccountCard / active">
          <AccountCard account={{ accountId: "acct_mock_maya", status: "ACTIVE", label: "Maya Chen" }} />
        </Variant>
        <Variant caption="AccountCard / action required">
          <AccountCard account={{ accountId: "acct_mock_maya", status: "ACTION_REQUIRED", label: "Maya Chen" }} />
        </Variant>
      </KitSection>

      <KitSection id="test-card-hint" title="TestCardHint" note="Sandbox cards with copy buttons.">
        <Variant caption="TestCardHint / success and decline" className="@min-[720px]:col-span-2">
          <TestCardHint cards={testCards} />
        </Variant>
      </KitSection>

      <KitSection id="mock-card-form" title="MockCardForm" note="Idle, submitting, declined, and success. The live form accepts the sandbox cards.">
        <Variant caption="MockCardForm / idle">
          <MockCardForm amount={money(150_000)} />
        </Variant>
        <Variant caption="MockCardForm / submitting">
          <MockCardForm amount={money(150_000)} phase="submitting" />
        </Variant>
        <Variant caption="MockCardForm / declined">
          <MockCardForm amount={money(150_000)} phase="declined" />
        </Variant>
        <Variant caption="MockCardForm / success">
          <MockCardForm amount={money(150_000)} phase="success" />
        </Variant>
      </KitSection>

      <KitSection id="drop-in-checkout" title="DropInCheckout" note="Placeholder until a real PaymentIntent exists.">
        <Variant caption="DropInCheckout / placeholder" className="@min-[720px]:col-span-2">
          <DropInCheckout />
        </Variant>
      </KitSection>

      <KitSection id="user-picker" title="UserPicker" note="Search uses the mock transport after two characters.">
        <Variant caption="UserPicker / search" className="@min-[720px]:col-span-2">
          <UserPicker />
        </Variant>
      </KitSection>

      <KitSection id="milestone-editor" title="MilestoneEditor" note="One row, several rows, a row error, and the maximum.">
        <Variant caption="MilestoneEditor / 1 row" className="@min-[720px]:col-span-2">
          <MilestoneEditor defaultRows={[{ title: "Moodboard", amount: "300.00" }]} />
        </Variant>
        <Variant caption="MilestoneEditor / several rows" className="@min-[720px]:col-span-2">
          <MilestoneEditor
            defaultRows={[
              { title: "Moodboard", amount: "300.00" },
              { title: "Logo", amount: "700.00" },
              { title: "Brand kit", amount: "500.00" },
            ]}
          />
        </Variant>
        <Variant caption="MilestoneEditor / row error" className="@min-[720px]:col-span-2">
          <MilestoneEditor defaultRows={[{ title: "Logo", amount: "4.00" }]} fieldErrors={{ "milestones.0.amount": "Minimum is $10.00." }} />
        </Variant>
        <Variant caption="MilestoneEditor / max reached" className="@min-[720px]:col-span-2">
          <MilestoneEditor max={3} defaultRows={[{ title: "One", amount: "100.00" }, { title: "Two", amount: "100.00" }, { title: "Three", amount: "100.00" }]} />
        </Variant>
      </KitSection>

      <KitSection id="provisioning-checklist" title="ProvisioningChecklist" note="Each provisioning step, including a failure with retry.">
        {provisioningSteps.map((step) => (
          <Variant key={step} caption={`ProvisioningChecklist / ${step}`}>
            <ProvisioningChecklist provisioning={{ step, error: step === "FAILED" ? "Airwallex could not activate the account." : undefined }} />
          </Variant>
        ))}
      </KitSection>
    </>
  );
}
