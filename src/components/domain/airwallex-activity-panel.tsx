"use client";

import { useState } from "react";
import type { AirwallexEventDTO } from "@/contracts/activity";
import { formatDay } from "@/components/domain/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { JsonViewer } from "@/components/ui/json-viewer";

export function AirwallexActivityPanel({
  events,
  defaultOpen = false,
}: {
  events: AirwallexEventDTO[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-md border border-border">
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-between rounded-md px-4 py-3"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span>Behind the scenes: Airwallex</span>
        <span className="text-xs text-muted-foreground">{open ? "Hide" : `${events.length} events`}</span>
      </Button>
      {open ? (
        <ul className="flex flex-col gap-3 border-t border-border px-4 py-3">
          {events.map((event) => (
            <li key={event.id} className="flex min-w-0 flex-col gap-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={event.source === "WEBHOOK" ? "info" : "neutral"}>{event.source === "WEBHOOK" ? "Webhook" : "API call"}</Badge>
                <span className="text-xs text-muted-foreground">{formatDay(event.at)}</span>
                {event.source === "API_CALL" ? (
                  <Badge variant={event.status >= 400 ? "danger" : "success"}>
                    {event.method} {event.status}
                  </Badge>
                ) : (
                  <Badge variant={event.processed ? "success" : "danger"}>{event.processed ? "Processed" : "Failed"}</Badge>
                )}
              </div>
              <p className="truncate font-mono text-xs">
                {event.source === "API_CALL" ? event.path : event.name}
                {event.source === "API_CALL" && event.errorCode ? ` · ${event.errorCode}` : ""}
                {event.source === "WEBHOOK" && event.processingError ? ` · ${event.processingError}` : ""}
              </p>
              <JsonViewer
                value={event.source === "API_CALL" ? { request: event.requestBody, response: event.responseBody } : event.payload}
                defaultExpanded={event.id.endsWith("_open")}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
