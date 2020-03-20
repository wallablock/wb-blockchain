import Web3 from 'web3';
import { provider } from 'web3-core/types';
import { AbiItem, AbiInput } from "web3-utils";
import { abi as OfferAbi } from './contracts/Offer.json';

import { CreatedEvent, CompletedEvent, CancelledEvent } from "./events";

interface EventSignatureList {
    [event: string]: { topic: string, inputs: AbiInput[] }
}

interface ResyncUpdate {
    createdContracts: Array<CreatedEvent>,
    completedContracts: Array<CompletedEvent>,
    cancelledContracts: Array<CancelledEvent>
}

export class Blockchain {
    private web3: Web3;
    private readonly events: EventSignatureList;

    constructor(node: provider = "ws://localhost:8545") {
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

    public async resync(fromBlock?: string): Promise<ResyncUpdate> {
        const runQuery = (eventName: string) => this.web3.eth.getPastLogs({
            fromBlock,
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
            createdContracts,
            completedContracts,
            cancelledContracts
        };
    }
}
