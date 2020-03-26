import Web3 from 'web3';
import { provider, Log } from 'web3-core/types';
import { Subscription } from 'web3-core-subscriptions/types';
import { AbiItem, AbiInput } from "web3-utils";
import { abi as OfferAbi } from './contracts/Offer.json';

import { CreatedEvent, CompletedEvent, CancelledEvent } from "./events";
import { makeCreatedEvent } from "./events";

interface EventSignatureList {
    [event: string]: { topic: string, inputs: AbiInput[] }
}

interface ResyncUpdate {
    syncedToBlock: number,
    createdContracts: Array<CreatedEvent>,
    completedContracts: Array<CompletedEvent>,
    cancelledContracts: Array<CancelledEvent>
}

class EventSubscription {
    constructor(private subscription: Subscription<Log> | null) {}

    public unsubscribe() {
        if (this.subscription != null) {
            this.subscription.unsubscribe();
            this.subscription = null;
        }
    }
}

export type BlockchainUrl = provider;

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
        const createdInputs = this.events['Created'].inputs;
        let subscription = this.web3.eth.subscribe('logs', {
            fromBlock,
            topics: [this.events['Created'].topic]
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
        return new EventSubscription(subscription);
    }

    public onCompleted(
        callback: (event: CompletedEvent) => void,
        onRevert: (event: CompletedEvent) => void,
        onError?: (name: string, message: string) => void,
        fromBlock?: string | number
    ): EventSubscription {
        let subscription = this.web3.eth.subscribe('logs', {
            fromBlock,
            topics: [this.events['Completed'].topic]
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
        return new EventSubscription(subscription);
    }

    public onCancelled(
        callback: (event: CancelledEvent) => void,
        onRevert: (event: CancelledEvent) => void,
        onError?: (name: string, message: string) => void,
        fromBlock?: string | number
    ): EventSubscription {
        let subscription = this.web3.eth.subscribe('logs', {
            fromBlock,
            topics: [this.events['Cancelled'].topic]
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
        return new EventSubscription(subscription);
    }

    public async resync(fromBlock?: string | number): Promise<ResyncUpdate> {
        const latestBlock = await this.web3.eth.getBlockNumber();
        const runQuery = (eventName: string) => this.web3.eth.getPastLogs({
            fromBlock,
            toBlock: latestBlock,
            topics: [this.events[eventName].topic]
        });
        let createdContracts = new Array<CreatedEvent>();
        let completedContracts = new Array<CompletedEvent>();
        let cancelledContracts = new Array<CancelledEvent>();
        let createdEvents = runQuery('Created');
        let completedEvents = runQuery('Completed');
        let cancelledEvents = runQuery('Cancelled');

        let createdInputs = this.events['Created'].inputs;
        for (let event of await createdEvents) {
            let data = this.web3.eth.abi.decodeLog(createdInputs, event.data, event.topics);
            createdContracts.push({
                offer: event.address,
                seller: data.seller,
                title: data.title,
                price: data.price,
                category: data.category,
                shipsFrom: data.shipsFrom
            })
        }

        for (let event of await completedEvents) {
            completedContracts.push({
                offer: event.address
            })
        }

        for (let event of await cancelledEvents) {
            cancelledContracts.push({
                offer: event.address
            })
        }

        return {
            syncedToBlock: latestBlock,
            createdContracts,
            completedContracts,
            cancelledContracts
        };
    }
}
