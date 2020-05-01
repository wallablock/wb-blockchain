import { Log } from "web3-core/types";
import { Subscription } from "web3-core-subscriptions/types";

export interface EventSubscription {
  unsubscribe(): void;
}

export class SimpleEventSubscription implements EventSubscription {
  constructor(private subscription: Subscription<Log> | null) {}
  public unsubscribe() {
    if (this.subscription != null) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }
}

export class CombinedEventSubscription implements EventSubscription {
  constructor(private subscriptions: EventSubscription[]) {}
  public unsubscribe() {
    for (let subs of this.subscriptions) {
      subs.unsubscribe();
    }
    this.subscriptions = [];
  }
}
