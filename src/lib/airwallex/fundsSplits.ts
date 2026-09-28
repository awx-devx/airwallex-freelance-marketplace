import { toAwxAmountString } from "@/lib/money";
import { createResource, request } from "./client";
import { asJsonObject, readItems, readString, type JsonObject } from "./json";

export type CreateFundsSplitInput = {
  amountMinor: number;
  currency: string;
  destination: string;
  sourceId: string;
  requestId: string;
  autoRelease: boolean;
  metadata?: Record<string, string>;
  relatedOfferId?: string;
  relatedMilestoneId?: string;
};

export function buildFundsSplitBody(input: CreateFundsSplitInput): JsonObject {
  return {
    amount: toAwxAmountString(input.amountMinor, input.currency),
    destination: input.destination,
    source_id: input.sourceId,
    source_type: "PAYMENT_INTENT",
    request_id: input.requestId,
    auto_release: input.autoRelease,
    ...(input.metadata ? { metadata: input.metadata } : {}),
  };
}

async function findSplit(input: CreateFundsSplitInput): Promise<JsonObject | undefined> {
  const listed = await request<unknown>("GET", "/api/v1/pa/funds_splits", {
    query: { source_id: input.sourceId, source_type: "PAYMENT_INTENT", page_size: 50 },
  });
  return asJsonObject(readItems(listed).find((item) => readString(item, "request_id") === input.requestId));
}

export async function createFundsSplit(input: CreateFundsSplitInput): Promise<JsonObject> {
  return createResource("/api/v1/pa/funds_splits/create", buildFundsSplitBody(input), () => findSplit(input), {
    relatedOfferId: input.relatedOfferId,
    relatedMilestoneId: input.relatedMilestoneId,
  });
}

export async function releaseFundsSplit(splitId: string, requestId: string): Promise<JsonObject> {
  return createResource(
    `/api/v1/pa/funds_splits/${splitId}/release`,
    { request_id: requestId },
    async () => retrieveFundsSplit(splitId),
  );
}

export async function retrieveFundsSplit(splitId: string): Promise<JsonObject> {
  return request<JsonObject>("GET", `/api/v1/pa/funds_splits/${splitId}`);
}

export async function listFundsSplits(sourceId: string): Promise<unknown> {
  return request<unknown>("GET", "/api/v1/pa/funds_splits", {
    query: { source_id: sourceId, source_type: "PAYMENT_INTENT", page_size: 50 },
  });
}

export type CreateReversalInput = {
  fundsSplitId: string;
  amountMinor: number;
  currency: string;
  requestId: string;
};

export function buildReversalBody(input: CreateReversalInput): JsonObject {
  return {
    funds_split_id: input.fundsSplitId,
    amount: toAwxAmountString(input.amountMinor, input.currency),
    request_id: input.requestId,
  };
}

async function findReversal(input: CreateReversalInput): Promise<JsonObject | undefined> {
  const listed = await request<unknown>("GET", "/api/v1/pa/funds_split_reversals", {
    query: { funds_split_id: input.fundsSplitId, page_size: 20 },
  });
  return asJsonObject(readItems(listed).find((item) => readString(item, "request_id") === input.requestId));
}

export async function createFundsSplitReversal(input: CreateReversalInput): Promise<JsonObject> {
  return createResource(
    "/api/v1/pa/funds_split_reversals/create",
    buildReversalBody(input),
    () => findReversal(input),
  );
}

export async function retrieveFundsSplitReversal(reversalId: string): Promise<JsonObject> {
  return request<JsonObject>("GET", `/api/v1/pa/funds_split_reversals/${reversalId}`);
}
