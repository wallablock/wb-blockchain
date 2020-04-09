import Web3 from 'web3';
import { Contract, EventData } from "web3-eth-contract";
import { provider } from 'web3-core/types';
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
    private offerContract: Contract;

    constructor(node: BlockchainUrl = "ws://localhost:8545") {
        this.web3 = new Web3(node);
        this.offerContract = new this.web3.eth.Contract(OfferAbi as AbiItem[]);
    }

    public onCreated(
        callback: (event: CreatedEvent) => void,
        onRevert: (event: CreatedEvent) => void,
        onError: (name: string, message: string) => void = nopError,
        fromBlock?: string | number
    ): EventSubscription {
        const subscription = this.offerContract.events[EventEnum.CREATED]({
            fromBlock
        })
        .on('data', (data: EventData) => callback(makeCreatedEvent(data.address, data.returnValues)))
        .on('changed', (data: EventData) => onRevert(makeCreatedEvent(data.address, data.returnValues)))
        .on('error', (error: Error) => onError(error.name, error.message));
        // TODO: Handle case: removed from blockchain. See subscription.on('changed')
        return new SimpleEventSubscription(subscription)
    }

    public onCompleted(
        callback: (event: CompletedEvent) => void,
        onRevert: (event: CompletedEvent) => void,
        onError: (name: string, message: string) => void = nopError,
        fromBlock?: string | number
    ): EventSubscription {
        const subscription = this.offerContract.events[EventEnum.COMPLETED]({
            fromBlock
        })
        .on('data', (data: EventData) => callback({ offer: data.address }))
        .on('changed', (data: EventData) => onRevert({ offer: data.address }))
        .on('error', (error: Error) => onError(error.name, error.message));
        return new SimpleEventSubscription(subscription);
    }

    public onCancelled(
        callback: (event: CancelledEvent) => void,
        onRevert: (event: CancelledEvent) => void,
        onError: (name: string, message: string) => void = nopError,
        fromBlock?: string | number
    ): EventSubscription {
        const subscription = this.offerContract.events[EventEnum.CANCELLED]({
            fromBlock
        })
        .on('data', (data: EventData) => callback({ offer: data.address }))
        .on('changed', (data: EventData) => onRevert({ offer: data.address }))
        .on('error', (error: Error) => onError(error.name, error.message));
        return new SimpleEventSubscription(subscription);
    }

    public onBought(
        callback: (event: BoughtEvent) => void,
        onRevert: (event: BoughtEvent) => void,
        onError: (name: string, message: string) => void = nopError,
        fromBlock?: string | number
    ): EventSubscription {
        const subscription = this.offerContract.events[EventEnum.BOUGHT]({
            fromBlock
        })
        .on('data', (data: EventData) => callback({
            offer: data.address,
            buyer: data.returnValues.buyer
        }))
        .on('changed', (data: EventData) => onRevert({
            offer: data.address,
            buyer: data.returnValues.buyer
        }))
        .on('error', (error: Error) => onError(error.name, error.message));
        return new SimpleEventSubscription(subscription);
    }

    public onBuyerRejected(
        callback: (event: BuyerRejectedEvent) => void,
        onRevert: (event: BuyerRejectedEvent) => void,
        onError: (name: string, message: string) => void = nopError,
        fromBlock?: string | number
    ): EventSubscription {
        const subscription = this.offerContract.events[EventEnum.BUYER_REJECTED]({
            fromBlock
        })
        .on('data', (data: EventData) => callback({ offer: data.address }))
        .on('changed', (data: EventData) => onRevert({ offer: data.address }))
        .on('error', (error: Error) => onError(error.name, error.message));
        return new SimpleEventSubscription(subscription);
    }

    public onChanged(
        callback: (event: ChangedEvent) => void,
        onRevert: (event: ChangedEvent) => void,
        onError: (name: string, message: string) => void = nopError,
        fromBlock?: string | number
    ): EventSubscription {
        let subscriptions = new Array<EventSubscription>();
        for (let { event, objField, ethField } of CHANGE_MAPPING) {
            let subscription = this.offerContract.events[event]({
                fromBlock
            })
            .on('data', (data: EventData) => callback({
                offer: data.address,
                [objField]: data.returnValues[ethField]
            }))
            .on('changed', (data: EventData) => onRevert({
                offer: data.address,
                [objField]: data.returnValues[ethField]
            }))
            .on('error', (error: Error) => onError(error.name, error.message));
            subscriptions.push(new SimpleEventSubscription(subscription));
        }
        return new CombinedEventSubscription(subscriptions);
    }

    public resync(fromBlock?: string | number): ResyncUpdate {
        let latestBlockPromise = this.web3.eth.getBlockNumber();
        const runQuery = (eventName: EventEnum) => latestBlockPromise
            .then(toBlock => this.offerContract.getPastEvents(eventName, {
                fromBlock,
                toBlock
            }));
        const simpleConvert = function(event: EventData): BlockchainEvent {
            return { offer: event.address };
        }

        return {
            syncedToBlock: latestBlockPromise,
            createdContracts: runQuery(EventEnum.CREATED)
                .then(events => events
                    .map(event => makeCreatedEvent(event.address, event.returnValues))),
            completedContracts: runQuery(EventEnum.COMPLETED)
                    .then(events => events.map(simpleConvert)),
            cancelledContracts: runQuery(EventEnum.CANCELLED)
                    .then(events => events.map(simpleConvert)),
            boughtContracts: runQuery(EventEnum.BOUGHT)
                .then(events => events.map(event => {
                    return {
                        offer: event.address,
                        buyer: event.returnValues.buyer
                    };
                })),
            buyerRejectedContracts: runQuery(EventEnum.BUYER_REJECTED)
                    .then(events => events.map(simpleConvert)),
            changedContracts: this.changedForResync(runQuery)
        }
    }

    private async changedForResync(runQuery: (eventName: EventEnum) => Promise<EventData[]>): Promise<ChangedEvent[]> {
        const fetchChanged = async function(eventName: EventEnum, objKey: keyof ChangedEvent, ethKey: string): Promise<ChangedEvent[]> {
            const events = await runQuery(eventName);
            return events.map(event => {
                return {
                    offer: event.address,
                    [objKey]: event.returnValues[ethKey]
                };
            });
        }
        let waitingPromises = new Array<Promise<ChangedEvent[]>>();
        for (let { event, objField, ethField } of CHANGE_MAPPING) {
            waitingPromises.push(fetchChanged(event, objField, ethField));
        }
        const events = await Promise.all(waitingPromises);
        // Flatten array. events.flat() could also be used, but that requires ESNext.
        return (new Array<ChangedEvent>()).concat(...events);
    }

    public async findCid(cid: string): Promise<CidSearchResult> {
        let events = this.offerContract.getPastEvents(EventEnum.ATTACHED_FILES_CHANGED, {
            filter: {
                newCID: cid
            }
        });
        let existed = false;
        for (let event of await events) {
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

function nopError(_e: string, _m: string) {}

interface ChangeMap {
    event: EventEnum,
    objField: keyof ChangedEvent,
    ethField: string
}

const CHANGE_MAPPING: ChangeMap[] = [
    {
        event: EventEnum.TITLE_CHANGED,
        objField: "title",
        ethField: "newTitle"
    },
    {
        event: EventEnum.PRICE_CHANGED,
        objField: "price",
        ethField: "newPrice"
    },
    {
        event: EventEnum.CATEGORY_CHANGED,
        objField: "category",
        ethField: "newCategory"
    },
    {
        event: EventEnum.SHIPS_FROM_CHANGED,
        objField: "shipsFrom",
        ethField: "newShipsFrom"
    }
];
