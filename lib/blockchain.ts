import Web3 from 'web3';
import { provider, Log } from 'web3-core/types';
import { AbiItem, AbiInput } from "web3-utils";
import { abi as OfferAbi } from "wb-contracts/build/contracts/Offer.json";
import {
    CreatedEvent,
    CompletedEvent,
    CancelledEvent,
    BoughtEvent,
    BuyerRejectedEvent,
    BlockchainEvent,
    ChangedEvent
} from "./events";
import { EventSubscription, SimpleEventSubscription, CombinedEventSubscription } from './event-subscription';
import { Events as EventEnum } from "./blockchain-names";

interface EventSignatureList {
    [event: string]: { topic: string, inputs: AbiInput[] }
}

export interface ResyncUpdate {
    syncedToBlock: Promise<number>,
    createdContracts: Promise<CreatedEvent[]>,
    completedContracts: Promise<CompletedEvent[]>,
    cancelledContracts: Promise<CancelledEvent[]>,
    boughtContracts: Promise<BoughtEvent[]>,
    buyerRejectedContracts: Promise<BuyerRejectedEvent[]>,
    changedContracts: Promise<ChangedEvent[]>
}

export type BlockchainUrl = provider;

export enum CidSearchResult {
    FOUND,
    NOT_FOUND,
    GONE
}

export class Blockchain {
    private web3: Web3;
    private readonly events: EventSignatureList;

    constructor(node: BlockchainUrl = "ws://localhost:8545") {
        this.web3 = new Web3(node);
        this.events = Blockchain.parseEvents(this.web3, OfferAbi as AbiItem[]);
    }

    private static parseEvents(web3: Web3, abi: AbiItem[]): EventSignatureList {
        let res: EventSignatureList = {};
        for (let entry of abi) {
            if (entry.type === "event") {
                res[entry.name!] = {
                    topic: web3.eth.abi.encodeEventSignature(entry),
                    inputs: entry.inputs!
                }
            }
        }
        return res;
    }

    public onCreated(
        callback: (event: CreatedEvent) => void,
        onRevert: (event: CreatedEvent) => void,
        onError?: (name: string, message: string) => void,
        fromBlock?: string | number
    ): EventSubscription {
        const createdInputs = this.events[EventEnum.CREATED].inputs;
        let subscription = this.web3.eth.subscribe('logs', {
            fromBlock,
            topics: [this.events[EventEnum.CREATED].topic]
        })
        .on('data', (data) => {
            const event = this.web3.eth.abi.decodeLog(createdInputs, data.data, data.topics);
            callback(makeCreatedEvent(data.address, event));
        })
        .on('changed', (data) => {
            const event = this.web3.eth.abi.decodeLog(createdInputs, data.data, data.topics);
            onRevert(makeCreatedEvent(data.address, event));
        });
        if (onError != null) {
            subscription.on('error', (error) => onError(error.name, error.message));
        }
        // TODO: Handle case: removed from blockchain. See subscription.on('changed')
        return new SimpleEventSubscription(subscription);
    }

    public onCompleted(
        callback: (event: CompletedEvent) => void,
        onRevert: (event: CompletedEvent) => void,
        onError?: (name: string, message: string) => void,
        fromBlock?: string | number
    ): EventSubscription {
        let subscription = this.web3.eth.subscribe('logs', {
            fromBlock,
            topics: [this.events[EventEnum.COMPLETED].topic]
        })
        .on('data', (data) => {
            callback({ offer: data.address });
        })
        .on('changed', (data) => {
            onRevert({ offer: data.address });
        });
        if (onError != null) {
            subscription.on('error', (error) => onError(error.name, error.message));
        }
        return new SimpleEventSubscription(subscription);
    }

    public onCancelled(
        callback: (event: CancelledEvent) => void,
        onRevert: (event: CancelledEvent) => void,
        onError?: (name: string, message: string) => void,
        fromBlock?: string | number
    ): EventSubscription {
        let subscription = this.web3.eth.subscribe('logs', {
            fromBlock,
            topics: [this.events[EventEnum.CANCELLED].topic]
        })
        .on('data', (data) => {
            callback({ offer: data.address });
        })
        .on('changed', (data) => {
            onRevert({ offer: data.address });
        });
        if (onError != null) {
            subscription.on('error', (error) => onError(error.name, error.message));
        }
        return new SimpleEventSubscription(subscription);
    }

    public onBought(
        callback: (event: BoughtEvent) => void,
        onRevert: (event: BoughtEvent) => void,
        onError?: (name: string, message: string) => void,
        fromBlock?: string | number
    ): EventSubscription {
        const eventInputs = this.events[EventEnum.BOUGHT].inputs;
        let subscription = this.web3.eth.subscribe('logs', {
            fromBlock,
            topics: [this.events[EventEnum.BOUGHT].topic]
        })
        .on('data', (data) => {
            const event = this.web3.eth.abi.decodeLog(eventInputs, data.data, data.topics);
            callback({ offer: data.address, buyer: event.buyer });
        })
        .on('changed', (data) => {
            const event = this.web3.eth.abi.decodeLog(eventInputs, data.data, data.topics);
            onRevert({ offer: data.address, buyer: event.buyer });
        })
        if (onError != null) {
            subscription.on('error', (error) => onError(error.name, error.message));
        }
        return new SimpleEventSubscription(subscription);
    }

    public onBuyerRejected(
        callback: (event: BuyerRejectedEvent) => void,
        onRevert: (event: BuyerRejectedEvent) => void,
        onError?: (name: string, message: string) => void,
        fromBlock?: string | number
    ): EventSubscription {
        let subscription = this.web3.eth.subscribe('logs', {
            fromBlock,
            topics: [this.events[EventEnum.BUYER_REJECTED].topic]
        })
        .on('data', (data) => {
            callback({ offer: data.address });
        })
        .on('changed', (data) => {
            onRevert({ offer: data.address });
        });
        if (onError != null) {
            subscription.on('error', (error) => onError(error.name, error.message));
        }
        return new SimpleEventSubscription(subscription);
    }

    public onChanged(
        callback: (event: ChangedEvent) => void,
        onRevert: (event: ChangedEvent) => void,
        onError?: (name: string, message: string) => void,
        fromBlock?: string | number
    ): EventSubscription {
        type Change = {
            on: EventEnum,
            fromField: string,
            toField: keyof ChangedEvent
        };
        const changes: Change[] = [
            {
                on: EventEnum.TITLE_CHANGED,
                fromField: "newTitle",
                toField: "title"
            },
            {
                on: EventEnum.PRICE_CHANGED,
                fromField: "newPrice",
                toField: "price"
            },
            {
                on: EventEnum.CATEGORY_CHANGED,
                fromField: "newCategory",
                toField: "category"
            },
            {
                on: EventEnum.SHIPS_FROM_CHANGED,
                fromField: "newShipsFrom",
                toField: "shipsFrom"
            }
        ];
        let subscriptions = new Array<EventSubscription>();
        for (let { on, fromField, toField } of changes) {
            const inputs = this.events[on].inputs;
            let subscription = this.web3.eth.subscribe('logs', {
                fromBlock,
                topics: [this.events[on].topic]
            })
            .on('data', (log) => {
                let data = this.web3.eth.abi.decodeLog(inputs, log.data, log.topics);
                callback({
                    offer: log.address,
                    [toField]: data[fromField]
                });
            })
            .on('changed', (log) => {
                let data = this.web3.eth.abi.decodeLog(inputs, log.data, log.topics);
                onRevert({
                    offer: log.address,
                    [toField]: data[fromField]
                });
            });
            if (onError != null) {
                subscription.on('error', (error) => onError(error.name, error.message));
            }
            subscriptions.push(subscription);
        }
        return new CombinedEventSubscription(subscriptions);
    }

    public resync(fromBlock?: string | number): ResyncUpdate {
        let latestBlockPromise = this.web3.eth.getBlockNumber();
        const createdInputs = this.events[EventEnum.CREATED].inputs;
        const boughtInputs = this.events[EventEnum.BOUGHT].inputs;
        const runQuery = (eventName: EventEnum) => latestBlockPromise
            .then((toBlock) => this.web3.eth.getPastLogs({
                fromBlock,
                toBlock,
                topics: [this.events[eventName].topic]
            }));
        const simpleConvert = function(log: Log): BlockchainEvent {
            return { offer: log.address };
        }

        return {
            syncedToBlock: latestBlockPromise,
            createdContracts: runQuery(EventEnum.CREATED).then(logs => logs.map(log => {
                let data = this.web3.eth.abi.decodeLog(createdInputs, log.data, log.topics);
                return makeCreatedEvent(log.address, data);
            })),
            completedContracts: runQuery(EventEnum.COMPLETED)
                .then((logs) => logs.map(simpleConvert)),
            cancelledContracts: runQuery(EventEnum.CANCELLED)
                .then((logs) => logs.map(simpleConvert)),
            boughtContracts: runQuery(EventEnum.BOUGHT).then(logs => logs.map(log => {
                let data = this.web3.eth.abi.decodeLog(boughtInputs, log.data, log.topics);
                return {
                    offer: log.address,
                    buyer: data.buyer
                };
            })),
            buyerRejectedContracts: runQuery(EventEnum.BUYER_REJECTED)
                .then((logs) => logs.map(simpleConvert)),
            changedContracts: this.changedForResync(runQuery)
        };
    }

    private async changedForResync(runQuery: (eventName: EventEnum) => Promise<Log[]>): Promise<ChangedEvent[]> {
        const titleChangedInputs = this.events[EventEnum.TITLE_CHANGED].inputs;
        const priceChangedInputs = this.events[EventEnum.PRICE_CHANGED].inputs;
        const categoryChangedInputs = this.events[EventEnum.CATEGORY_CHANGED].inputs;
        const shipsFromChangedInputs = this.events[EventEnum.SHIPS_FROM_CHANGED].inputs;
        let titleChanged = runQuery(EventEnum.TITLE_CHANGED).then(logs => logs.map(log => {
            let data = this.web3.eth.abi.decodeLog(titleChangedInputs, log.data, log.topics);
            return {
                offer: log.address,
                title: data.newTitle
            };
        }));
        let priceChanged = runQuery(EventEnum.PRICE_CHANGED).then(logs => logs.map(log => {
            let data = this.web3.eth.abi.decodeLog(priceChangedInputs, log.data, log.topics);
            return {
                offer: log.address,
                price: data.newPrice
            };
        }));
        let categoryChanged = runQuery(EventEnum.CATEGORY_CHANGED).then(logs => logs.map(log => {
            let data = this.web3.eth.abi.decodeLog(categoryChangedInputs, log.data, log.topics);
            return {
                offer: log.address,
                category: data.newCategory
            };
        }));
        let shipsFromChanged = runQuery(EventEnum.SHIPS_FROM_CHANGED).then(logs => logs.map(log => {
            let data = this.web3.eth.abi.decodeLog(shipsFromChangedInputs, log.data, log.topics);
            return {
                offer: log.address,
                shipsFrom: data.newShipsFrom
            };
        }));
        const events = await Promise.all([titleChanged, priceChanged, categoryChanged, shipsFromChanged]);
        // Flatten array. events.flat() could also be used, but that requires ESNext.
        return (new Array<ChangedEvent>()).concat(...events);
    }

    public async findCid(cid: string): Promise<CidSearchResult> {
        const filesTopic = this.events[EventEnum.ATTACHED_FILES_CHANGED].topic;
        const cidTopic = this.web3.utils.soliditySha3({type: 'string', value: cid});
        let logs = this.web3.eth.getPastLogs({
            topics: [filesTopic, cidTopic]
        });
        let existed = false;
        for (let log of await logs) {
            existed = true;
            // TODO: Check if stills exists
        }
        if (existed) {
            return CidSearchResult.GONE;
        } else {
            return CidSearchResult.NOT_FOUND;
        }
    }
}

function makeCreatedEvent(offer: string, data: any): CreatedEvent {
    return {
        offer,
        seller: data.seller,
        title: data.title,
        price: data.price,
        category: data.category,
        shipsFrom: data.shipsFrom
    }
}
