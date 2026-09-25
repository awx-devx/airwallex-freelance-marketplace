"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { applyScenario, flushMockWebhooks, getDb, resetMockDb, setMockLatency, setMockUser } from "@/lib/api/mock";
import { SCENARIOS } from "@/lib/api/mock/scenarios";

export default function MockDevtools() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const refresh = () => {
    setVersion((value) => value + 1);
    void qc.invalidateQueries();
  };
  const snapshot = getDb();
  const people = snapshot.users.filter((user) => user.kind !== "REVENUE");

  if (!open) {
    return (
      <Button type="button" variant="outline" className="fixed top-4 right-4 z-40" onClick={() => setOpen(true)}>
        Mock
      </Button>
    );
  }

  return (
    <aside key={version} className="fixed top-4 right-4 z-40 flex w-72 flex-col gap-3 rounded-md border border-border bg-background p-3 text-sm">
      <div className="flex items-center justify-between">
        <p className="font-medium">Mock data</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </div>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        User
        <select
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
          value={snapshot.sessionUserId ?? ""}
          onChange={(event) => {
            if (!event.target.value) return;
            setMockUser(event.target.value);
            refresh();
          }}
        >
          <option value="" disabled>
            Signed out
          </option>
          {people.map((user) => (
            <option key={user.id} value={user.id}>
              {user.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Scenario
        <select
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
          value={snapshot.scenario}
          onChange={(event) => {
            applyScenario(event.target.value as typeof snapshot.scenario);
            refresh();
          }}
        >
          {SCENARIOS.map((scenario) => (
            <option key={scenario.id} value={scenario.id}>
              {scenario.label}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Latency (ms)
        <input
          type="number"
          min={0}
          placeholder="250–700"
          className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"
          onChange={(event) => setMockLatency(Number(event.target.value) || 0)}
        />
      </label>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            resetMockDb();
            refresh();
          }}
        >
          Reset
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            flushMockWebhooks();
            refresh();
          }}
        >
          Fire webhook now
        </Button>
      </div>
    </aside>
  );
}
