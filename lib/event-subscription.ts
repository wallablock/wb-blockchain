import { Log } from 'web3-core/types';
import { Subscription } from 'web3-core-subscriptions/types';
export class EventSubscription {
    constructor(private subscription: Subscription<Log> | null) { }
    public unsubscribe() {
        if (this.subscription != null) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
    }
}
