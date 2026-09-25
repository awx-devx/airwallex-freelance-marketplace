import { createSeedDb } from "@/lib/api/mock/fixtures";
import { resetMockJobs } from "@/lib/api/mock/simulate";
import type { MockDb, MockFault, ScenarioId } from "@/lib/api/mock/types";

const STORAGE_KEY = "awx-escrow.mock.v1";

let db: MockDb | undefined;
let faults: MockFault[] = [];
let latencyOverride: number | null = process.env.VITEST ? 0 : null;
let idSeq = 1000;

function canPersist() {
  return typeof window !== "undefined" && !process.env.VITEST;
}

function persist() {
  if (!canPersist() || !db) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

function bumpIdSeq(id: string) {
  const match = /_([0-9a-z]+)$/.exec(id);
  if (!match?.[1]) return;
  const value = Number.parseInt(match[1], 36);
  if (!Number.isFinite(value) || value > 1_000_000 || value.toString(36) !== match[1]) return;
  if (value > idSeq) idSeq = value;
}

function syncIdSeq(stored: MockDb) {
  for (const item of stored.activity) bumpIdSeq(item.id);
  for (const item of stored.events) bumpIdSeq(item.id);
  for (const item of stored.transactions) bumpIdSeq(item.id);
  for (const offer of stored.offers) {
    bumpIdSeq(offer.id);
    for (const milestone of offer.milestones) {
      bumpIdSeq(milestone.id);
      for (const delivery of milestone.deliveries) bumpIdSeq(delivery.id);
    }
  }
}

export function getDb(): MockDb {
  if (db) return db;
  if (canPersist()) {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        db = JSON.parse(raw) as MockDb;
        syncIdSeq(db);
        return db;
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }
  db = createSeedDb();
  syncIdSeq(db);
  return db;
}

export function replaceDb(next: MockDb) {
  resetMockJobs();
  faults = [];
  db = next;
  persist();
}

export function commit() {
  persist();
}

export function nextId(prefix: string) {
  idSeq += 1;
  return `${prefix}_${idSeq.toString(36)}`;
}

export function nowIso() {
  return new Date().toISOString();
}

export function getFaults() {
  return faults;
}

export function armFault(fault: MockFault) {
  faults.push(fault);
}

export function clearFaults() {
  faults = [];
}

export function consumeFault(path: string): MockFault | undefined {
  const index = faults.findIndex((fault) => fault.times > 0 && path.includes(fault.pathIncludes));
  const fault = index >= 0 ? faults[index] : undefined;
  if (!fault) return undefined;
  fault.times -= 1;
  if (fault.times <= 0) faults.splice(index, 1);
  return fault;
}

export function setLatencyOverride(ms: number | null) {
  latencyOverride = ms;
}

export function latencyDelayMs() {
  if (latencyOverride !== null) return latencyOverride;
  return 250 + Math.floor(Math.random() * 451);
}

export function setScenario(scenario: ScenarioId) {
  getDb().scenario = scenario;
  commit();
}

export function emptyNewUser(): MockDb {
  const next = createSeedDb();
  next.scenario = "empty-new-user";
  next.users.push({
    id: "usr_new",
    email: "new@demo.test",
    password: "demo1234",
    name: "New User",
    headline: "Just looking around",
    avatarColor: "#57534E",
    initials: "NU",
    kind: "REGULAR",
    isGuestPool: false,
    airwallex: { accountId: "acct_mock_new", accountStatus: "ACTIVE" },
    provisioning: { step: "READY" },
    availableMinor: 500_000,
    pendingMinor: 0,
    reservedMinor: 0,
  });
  next.sessionUserId = "usr_new";
  return next;
}
