import { AsyncLocalStorage } from "node:async_hooks";

export type AirwallexCallContext = {
  relatedOfferId?: string;
  relatedMilestoneId?: string;
  relatedUserId?: string;
};

const storage = new AsyncLocalStorage<AirwallexCallContext>();

export function airwallexContext(): AirwallexCallContext | undefined {
  return storage.getStore();
}

export function withAirwallexContext<T>(context: AirwallexCallContext, run: () => Promise<T>): Promise<T> {
  return storage.run(context, run);
}
