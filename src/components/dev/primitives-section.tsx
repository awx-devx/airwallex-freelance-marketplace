"use client";

import { useState } from "react";
import { Inbox, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Checkbox } from "@/components/ui/checkbox";
import { CodeBlock } from "@/components/ui/code-block";
import { Combobox } from "@/components/ui/combobox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CopyButton } from "@/components/ui/copy-button";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { FormField } from "@/components/ui/form-field";
import { InitialsAvatar, InitialsAvatarGroup } from "@/components/ui/initials-avatar";
import { Input } from "@/components/ui/input";
import { JsonViewer } from "@/components/ui/json-viewer";
import { KeyValueList } from "@/components/ui/key-value-list";
import { Label } from "@/components/ui/label";
import { MoneyInput } from "@/components/ui/money-input";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Stepper } from "@/components/ui/stepper";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Timeline } from "@/components/ui/timeline";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { KitSection, Variant } from "@/components/dev/kit-section";

const buttonVariants = ["primary", "secondary", "outline", "ghost", "destructive", "link"] as const;
const sampleJson = {
  id: "off_123",
  note: "A very long deliverable note that should wrap instead of forcing the page wider than the preview.",
  amount: "450.00",
};

export function PrimitivesSection() {
  return (
    <>
      <ButtonsSection />
      <InputsSection />
      <MoneySection />
      <FormFieldSection />
      <SelectSection />
      <ComboboxSection />
      <ToggleSection />
      <DateSection />
      <CardSection />
      <BadgeSection />
      <TabsSection />
      <DialogSection />
      <MenuSection />
      <TooltipSection />
      <CalloutSection />
      <SkeletonSection />
      <SpinnerSection />
      <AvatarSection />
      <TableSection />
      <ProgressSection />
      <ListSection />
      <CopySection />
      <JsonSection />
      <EmptySection />
      <ErrorSection />
      <StepperSection />
      <TimelineSection />
      <ToasterSection />
    </>
  );
}

function ButtonsSection() {
  return (
    <KitSection id="buttons" title="Button" note="Primary actions use the violet accent. Loading keeps the label.">
      {buttonVariants.map((variant) => (
        <Variant key={variant} caption={`Button / ${variant}`}>
          <Button variant={variant}>{variant}</Button>
        </Variant>
      ))}
      <Variant caption="Button / primary / sm · md · lg">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
        </div>
      </Variant>
      <Variant caption="Button / primary / disabled">
        <Button disabled>Disabled</Button>
      </Variant>
      <Variant caption="Button / primary / loading">
        <Button loading>Releasing</Button>
      </Variant>
      <Variant caption="Button / primary / leading icon">
        <Button>
          <Plus />
          New offer
        </Button>
      </Variant>
      <Variant caption="Button / primary / icon-only">
        <Button size="icon" aria-label="New offer">
          <Plus />
        </Button>
      </Variant>
    </KitSection>
  );
}

function InputsSection() {
  return (
    <KitSection id="inputs" title="Input and Textarea" note="Invalid fields use the danger border and an error message.">
      <Variant caption="Input / default">
        <Input defaultValue="Maya Chen" aria-label="Name" />
      </Variant>
      <Variant caption="Input / placeholder">
        <Input placeholder="Email" aria-label="Email" />
      </Variant>
      <Variant caption="Input / disabled">
        <Input disabled value="Locked" aria-label="Locked" />
      </Variant>
      <Variant caption="Input / invalid">
        <div className="flex flex-col gap-1.5">
          <Input aria-invalid aria-label="Email" defaultValue="not-an-email" />
          <p className="text-sm text-danger">Enter a valid email.</p>
        </div>
      </Variant>
      <Variant caption="Input / prefix">
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-muted-foreground">
            $
          </span>
          <Input className="pl-6 tabular-nums" defaultValue="450.00" aria-label="Amount" />
        </div>
      </Variant>
      <Variant caption="Textarea / default">
        <Textarea defaultValue="Brand identity for the coffee shop." aria-label="Description" />
      </Variant>
      <Variant caption="Textarea / placeholder">
        <Textarea placeholder="What will you deliver?" aria-label="Delivery" />
      </Variant>
      <Variant caption="Textarea / disabled">
        <Textarea disabled value="Locked" aria-label="Locked note" />
      </Variant>
      <Variant caption="Textarea / invalid">
        <div className="flex flex-col gap-1.5">
          <Textarea aria-invalid defaultValue="" aria-label="Note" />
          <p className="text-sm text-danger">Add a short note.</p>
        </div>
      </Variant>
    </KitSection>
  );
}

function MoneySection() {
  return (
    <KitSection id="money-input" title="MoneyInput" note="Keeps the raw decimal string and previews a formatted amount.">
      <MoneyDemo caption="MoneyInput / empty" initial="" />
      <MoneyDemo caption="MoneyInput / valid" initial="450.00" />
      <MoneyDemo caption="MoneyInput / invalid" initial="4.5.0" />
      <MoneyDemo caption="MoneyInput / below minimum" initial="4.00" />
    </KitSection>
  );
}

function MoneyDemo({ caption, initial }: { caption: string; initial: string }) {
  const [value, setValue] = useState(initial);
  return (
    <Variant caption={caption}>
      <MoneyInput value={value} onChange={setValue} />
    </Variant>
  );
}

function FormFieldSection() {
  return (
    <KitSection id="form-field" title="Label and FormField" note="Hint, error, and the required marker share one field wrapper.">
      <Variant caption="FormField / label + hint">
        <FormField label="Headline" hint="Shown on your profile." htmlFor="headline">
          <Input id="headline" placeholder="Brand designer" />
        </FormField>
      </Variant>
      <Variant caption="FormField / required">
        <FormField label="Email" required htmlFor="email">
          <Input id="email" placeholder="you@studio.test" />
        </FormField>
      </Variant>
      <Variant caption="FormField / error">
        <FormField label="Email" required error="That email is already in use." htmlFor="email-error">
          <Input id="email-error" aria-invalid defaultValue="maya@studio.test" />
        </FormField>
      </Variant>
      <Variant caption="Label">
        <Label htmlFor="bare">Amount</Label>
        <Input id="bare" className="mt-1.5" placeholder="0.00" />
      </Variant>
    </KitSection>
  );
}

function SelectSection() {
  return (
    <KitSection id="select" title="Select" note="Use for a short, known list. Search uses Combobox.">
      <Variant caption="Select / default">
        <Select defaultValue="usd">
          <SelectTrigger aria-label="Currency">
            <SelectValue placeholder="Currency" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="usd">USD</SelectItem>
            <SelectItem value="eur">EUR</SelectItem>
          </SelectContent>
        </Select>
      </Variant>
      <Variant caption="Select / disabled">
        <Select defaultValue="usd" disabled>
          <SelectTrigger aria-label="Currency disabled">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="usd">USD</SelectItem>
          </SelectContent>
        </Select>
      </Variant>
      <Variant caption="Select / invalid">
        <div className="flex flex-col gap-1.5">
          <Select>
            <SelectTrigger aria-invalid aria-label="Currency invalid">
              <SelectValue placeholder="Choose a currency" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="usd">USD</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-danger">Choose a currency.</p>
        </div>
      </Variant>
    </KitSection>
  );
}

function ComboboxSection() {
  return (
    <KitSection id="combobox" title="Combobox" note="Base for the user picker. Results appear after two characters.">
      <Variant caption="Combobox / empty">
        <Combobox query="" onQueryChange={() => {}} items={[]} onSelect={() => {}} />
      </Variant>
      <Variant caption="Combobox / typing">
        <Combobox query="ma" onQueryChange={() => {}} loading items={[]} onSelect={() => {}} />
      </Variant>
      <Variant caption="Combobox / results">
        <Combobox
          query="maya"
          onQueryChange={() => {}}
          items={[{ id: "1", label: "Maya Chen", description: "Brand designer" }]}
          onSelect={() => {}}
        />
      </Variant>
      <Variant caption="Combobox / no results">
        <Combobox query="zzz" onQueryChange={() => {}} items={[]} onSelect={() => {}} />
      </Variant>
    </KitSection>
  );
}

function ToggleSection() {
  const [checked, setChecked] = useState(true);
  const [on, setOn] = useState(true);
  return (
    <KitSection id="checkbox" title="Checkbox and Switch" note="On, off, and disabled.">
      <Variant caption="Checkbox / on">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={checked} onCheckedChange={(value) => setChecked(value === true)} />
          Email me when a milestone is approved
        </label>
      </Variant>
      <Variant caption="Checkbox / off">
        <Checkbox checked={false} aria-label="Off" />
      </Variant>
      <Variant caption="Checkbox / disabled">
        <Checkbox disabled aria-label="Disabled" />
      </Variant>
      <Variant caption="Switch / on">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={on} onCheckedChange={setOn} />
          Pay from wallet
        </label>
      </Variant>
      <Variant caption="Switch / off">
        <Switch checked={false} aria-label="Off" />
      </Variant>
      <Variant caption="Switch / disabled">
        <Switch disabled aria-label="Disabled" />
      </Variant>
    </KitSection>
  );
}

function DateSection() {
  return (
    <KitSection id="date-input" title="DateInput" note="Native date input, styled like the other fields.">
      <Variant caption="DateInput / empty">
        <DateInput aria-label="Due date" />
      </Variant>
      <Variant caption="DateInput / filled">
        <DateInput aria-label="Due date filled" defaultValue="2026-10-12" />
      </Variant>
      <Variant caption="DateInput / invalid">
        <div className="flex flex-col gap-1.5">
          <DateInput invalid aria-label="Due date invalid" />
          <p className="text-sm text-danger">Pick a due date.</p>
        </div>
      </Variant>
    </KitSection>
  );
}

function CardSection() {
  return (
    <KitSection id="card" title="Card" note="Cards sit on the surface background. Interactive cards lift on hover.">
      <Variant caption="Card / plain">
        <Card>
          <CardContent>Milestone 1 · Discovery</CardContent>
        </Card>
      </Variant>
      <Variant caption="Card / header and footer">
        <Card>
          <CardHeader>
            <CardTitle>Coffee brand identity</CardTitle>
          </CardHeader>
          <CardContent>Three milestones, paid up front.</CardContent>
          <CardFooter>
            <Button size="sm">Review</Button>
          </CardFooter>
        </Card>
      </Variant>
      <Variant caption="Card / interactive">
        <Card interactive>
          <CardContent>Hover to lift the card.</CardContent>
        </Card>
      </Variant>
    </KitSection>
  );
}

function BadgeSection() {
  return (
    <KitSection id="badge" title="Badge" note="Status tones used by pills and counts.">
      {(["neutral", "info", "success", "warning", "danger", "outline"] as const).map((variant) => (
        <Variant key={variant} caption={`Badge / ${variant}`}>
          <Badge variant={variant}>{variant}</Badge>
        </Variant>
      ))}
    </KitSection>
  );
}

function TabsSection() {
  return (
    <KitSection id="tabs" title="Tabs" note="Counts sit in the trigger. Two to four tabs.">
      <Variant caption="Tabs / with counts" className="@min-[720px]:col-span-2">
        <Tabs defaultValue="incoming">
          <TabsList className="h-auto w-full max-w-full flex-wrap">
            <TabsTrigger value="incoming">
              Incoming <Badge variant="neutral">2</Badge>
            </TabsTrigger>
            <TabsTrigger value="buying">
              Buying <Badge variant="neutral">1</Badge>
            </TabsTrigger>
            <TabsTrigger value="selling">Selling</TabsTrigger>
            <TabsTrigger value="done">
              Done <Badge variant="neutral">4</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="incoming" className="pt-3 text-sm text-muted-foreground">
            Offers waiting for you.
          </TabsContent>
          <TabsContent value="buying" className="pt-3 text-sm text-muted-foreground">
            Contracts you are paying for.
          </TabsContent>
          <TabsContent value="selling" className="pt-3 text-sm text-muted-foreground">
            Offers you sent.
          </TabsContent>
          <TabsContent value="done" className="pt-3 text-sm text-muted-foreground">
            Finished contracts.
          </TabsContent>
        </Tabs>
      </Variant>
    </KitSection>
  );
}

function DialogSection() {
  const [open, setOpen] = useState(false);
  return (
    <KitSection id="dialog" title="Dialog" note="ConfirmDialog requires a reason before a destructive confirm.">
      <Variant caption="Dialog / basic">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Open dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Offer sent</DialogTitle>
              <DialogDescription>Maya can review it from her home page.</DialogDescription>
            </DialogHeader>
          </DialogContent>
        </Dialog>
      </Variant>
      <Variant caption="ConfirmDialog / destructive">
        <Button variant="destructive" onClick={() => setOpen(true)}>
          Cancel milestone
        </Button>
        <ConfirmDialog
          open={open}
          onOpenChange={setOpen}
          destructive
          requireReason
          title="Cancel this milestone?"
          description="$150.00 will be refunded to the buyer."
          confirmLabel="Cancel milestone"
          onConfirm={() => {}}
        />
      </Variant>
    </KitSection>
  );
}

function MenuSection() {
  return (
    <KitSection id="dropdown-menu" title="DropdownMenu" note="The account menu: wallet, platform, and log out.">
      <Variant caption="DropdownMenu / user menu">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">Maya Chen</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuLabel>maya@studio.test</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Wallet</DropdownMenuItem>
            <DropdownMenuItem>Platform</DropdownMenuItem>
            <DropdownMenuItem>UI kit</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Variant>
    </KitSection>
  );
}

function TooltipSection() {
  return (
    <KitSection id="tooltip" title="Tooltip" note="Short text, or a rich fee breakdown.">
      <Variant caption="Tooltip / text">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">Held</Button>
          </TooltipTrigger>
          <TooltipContent>Funds stay held until you approve.</TooltipContent>
        </Tooltip>
      </Variant>
      <Variant caption="Tooltip / rich">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline">$300.00</Button>
          </TooltipTrigger>
          <TooltipContent className="block items-start">
            <span className="block">Seller $270.00</span>
            <span className="block">Platform fee $24.00</span>
            <span className="block">Reserve $6.00</span>
          </TooltipContent>
        </Tooltip>
      </Variant>
    </KitSection>
  );
}

function CalloutSection() {
  return (
    <KitSection id="callout" title="Alert and Callout" note="Info, success, warning, and danger. An action sits on the right.">
      {(["info", "success", "warning", "danger"] as const).map((tone) => (
        <Variant key={tone} caption={`Callout / ${tone}`}>
          <Callout tone={tone} title={tone === "info" ? "Held in escrow" : tone}>
            {tone === "success" ? "Milestone paid." : "Sandbox payment. No real money moves."}
          </Callout>
        </Variant>
      ))}
      <Variant caption="Callout / with action" className="@min-[720px]:col-span-2">
        <Callout tone="warning" title="Still waiting" action={<Button size="sm">Sync now</Button>}>
          Airwallex has not confirmed this release yet.
        </Callout>
      </Variant>
    </KitSection>
  );
}

function SkeletonSection() {
  return (
    <KitSection id="skeleton" title="Skeleton" note="Match the shape of the content that is loading.">
      <Variant caption="Skeleton / text">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </Variant>
      <Variant caption="Skeleton / card">
        <div className="flex flex-col gap-3 rounded-lg border border-border p-4">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-3 w-full" />
        </div>
      </Variant>
      <Variant caption="Skeleton / table rows" className="@min-[720px]:col-span-2">
        <div className="flex flex-col gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="flex gap-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-16" />
            </div>
          ))}
        </div>
      </Variant>
    </KitSection>
  );
}

function SpinnerSection() {
  return (
    <KitSection id="spinner" title="Spinner" note="Small, medium, and large. Inline spinners sit in the line of text.">
      <Variant caption="Spinner / sm · md · lg">
        <div className="flex items-center gap-4 text-primary">
          <Spinner size="sm" />
          <Spinner size="md" />
          <Spinner size="lg" />
        </div>
      </Variant>
      <Variant caption="Spinner / inline">
        <p className="flex items-center gap-2 text-sm">
          <Spinner size="sm" />
          Releasing funds…
        </p>
      </Variant>
    </KitSection>
  );
}

function AvatarSection() {
  return (
    <KitSection id="avatar" title="Avatar" note="Initials pick a stable color from the name.">
      <Variant caption="Avatar / sm · md · lg">
        <div className="flex items-center gap-3">
          <InitialsAvatar name="Maya Chen" size="sm" />
          <InitialsAvatar name="Maya Chen" size="md" />
          <InitialsAvatar name="Maya Chen" size="lg" />
        </div>
      </Variant>
      <Variant caption="AvatarGroup">
        <InitialsAvatarGroup names={["Maya Chen", "Sam Rivera", "Omar Haddad"]} />
      </Variant>
    </KitSection>
  );
}

function TableSection() {
  return (
    <KitSection id="table" title="Table" note="Money columns are right-aligned and tabular.">
      <Variant caption="Table / rows" className="@min-[720px]:col-span-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Milestone</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>Discovery</TableCell>
              <TableCell className="text-right tabular-nums">$300.00</TableCell>
            </TableRow>
            <TableRow>
              <TableCell>Delivery</TableCell>
              <TableCell className="text-right tabular-nums">$700.00</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Variant>
      <Variant caption="Table / empty">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Milestone</TableHead>
              <TableHead className="text-right">Amount</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground">
                No milestones yet.
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </Variant>
      <Variant caption="Table / loading">
        <div className="flex flex-col gap-2 py-1">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
        </div>
      </Variant>
    </KitSection>
  );
}

function ProgressSection() {
  return (
    <KitSection id="progress" title="Progress" note="Offer completion, from nothing funded to fully paid.">
      {[0, 40, 100].map((value) => (
        <Variant key={value} caption={`Progress / ${value}%`}>
          <Progress value={value} aria-label={`${value}%`} />
        </Variant>
      ))}
    </KitSection>
  );
}

function ListSection() {
  return (
    <KitSection id="key-value-list" title="Separator and KeyValueList" note="IDs and amounts in a definition list.">
      <Variant caption="Separator">
        <div className="flex flex-col gap-3 text-sm">
          <span>Seller share</span>
          <Separator />
          <span>Platform fee</span>
        </div>
      </Variant>
      <Variant caption="KeyValueList">
        <KeyValueList
          items={[
            { label: "Offer", value: "off_123" },
            { label: "Amount", value: "$1,000.00" },
            { label: "Held", value: "$700.00" },
          ]}
        />
      </Variant>
    </KitSection>
  );
}

function CopySection() {
  return (
    <KitSection id="copy-button" title="CopyButton" note="Copies the value, then reads Copied.">
      <Variant caption="CopyButton / idle">
        <div className="flex items-center gap-2">
          <code className="font-mono text-xs">acct_demo_maya</code>
          <CopyButton value="acct_demo_maya" />
        </div>
      </Variant>
    </KitSection>
  );
}

function JsonSection() {
  return (
    <KitSection id="json-viewer" title="CodeBlock and JsonViewer" note="Long strings wrap. Expand to see formatted JSON.">
      <Variant caption="JsonViewer / collapsed">
        <JsonViewer value={sampleJson} />
      </Variant>
      <Variant caption="JsonViewer / expanded">
        <JsonViewer value={sampleJson} defaultExpanded />
      </Variant>
      <Variant caption="CodeBlock" className="@min-[720px]:col-span-2">
        <CodeBlock code={sampleJson.note} />
      </Variant>
    </KitSection>
  );
}

function EmptySection() {
  return (
    <KitSection id="empty-state" title="EmptyState" note="Tell the user what is missing and the next step.">
      <Variant caption="EmptyState" className="@min-[720px]:col-span-2">
        <EmptyState
          icon={<Inbox className="size-5" />}
          title="No offers yet"
          description="They'll appear here when someone sends you one."
          action={<Button size="sm">Create your first offer</Button>}
        />
      </Variant>
    </KitSection>
  );
}

function ErrorSection() {
  return (
    <KitSection id="error-state" title="ErrorState" note="Retry, and the Airwallex code when a call failed.">
      <Variant caption="ErrorState / retry">
        <ErrorState message="Couldn't release this milestone." onRetry={() => {}} />
      </Variant>
      <Variant caption="ErrorState / Airwallex">
        <ErrorState
          message="Airwallex rejected the release."
          onRetry={() => {}}
          airwallex={{ code: "invalid_status_for_operation", traceId: "tr_9f3a" }}
        />
      </Variant>
    </KitSection>
  );
}

function StepperSection() {
  return (
    <KitSection id="stepper" title="Stepper" note="Welcome provisioning: pending, active, done, and failed.">
      <Variant caption="Stepper / mixed" className="@min-[720px]:col-span-2">
        <Stepper
          steps={[
            { id: "account", label: "Create connected account", status: "done" },
            { id: "activate", label: "Activate account", status: "active", description: "Waiting on Airwallex" },
            { id: "credit", label: "Add $5,000.00 welcome credit", status: "pending" },
            { id: "offer", label: "Send welcome offer", status: "failed", description: "Retry to continue" },
          ]}
        />
      </Variant>
    </KitSection>
  );
}

function TimelineSection() {
  return (
    <KitSection id="timeline" title="Timeline" note="Actor, relative time, and an icon for each event.">
      <Variant caption="Timeline" className="@min-[720px]:col-span-2">
        <Timeline
          items={[
            {
              id: "1",
              icon: <Send className="size-3" />,
              actor: "Maya Chen",
              time: "2 hours ago",
              title: "Sent the offer",
            },
            {
              id: "2",
              icon: <Inbox className="size-3" />,
              actor: "Sam Rivera",
              time: "1 hour ago",
              title: "Submitted delivery for Milestone 1",
              description: "Figma file and brand notes.",
            },
          ]}
        />
      </Variant>
    </KitSection>
  );
}

function ToasterSection() {
  return (
    <KitSection id="toaster" title="Toaster" note="Success, error, info, and a loading toast that resolves.">
      <Variant caption="Toaster / success">
        <Button variant="outline" onClick={() => toast.success("Milestone paid")}>
          Success
        </Button>
      </Variant>
      <Variant caption="Toaster / error">
        <Button variant="outline" onClick={() => toast.error("Release failed")}>
          Error
        </Button>
      </Variant>
      <Variant caption="Toaster / info">
        <Button variant="outline" onClick={() => toast.info("Still waiting on Airwallex")}>
          Info
        </Button>
      </Variant>
      <Variant caption="Toaster / loading → success">
        <Button
          variant="outline"
          onClick={() => {
            const id = toast.loading("Releasing…");
            window.setTimeout(() => toast.success("Paid", { id }), 1200);
          }}
        >
          Release
        </Button>
      </Variant>
    </KitSection>
  );
}
