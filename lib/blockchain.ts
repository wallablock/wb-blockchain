import Web3 from "web3";
import { Contract, EventData } from "web3-eth-contract";
import { provider } from "web3-core/types";
import { HttpProvider } from "web3-providers-http";
import { WebsocketProvider } from "web3-providers-ws";
import { AbiItem } from "web3-utils";
import { abi as OfferAbi } from "wb-contracts/build/contracts/Offer.json";
import { abi as OfferRegistryAbi } from "wb-contracts/build/contracts/OfferRegistry.json";
import {
  CreatedEvent,
  CompletedEvent,
  CancelledEvent,
  BoughtEvent,
  BuyerRejectedEvent,
  BlockchainEvent,
  ChangedEvent,
} from "./events";
import {
  EventSubscription,
  SimpleEventSubscription,
  CombinedEventSubscription,
} from "./event-subscription";
import {
  Event as EventEnum,
  Property as PropertyEnum,
} from "./blockchain-names";
import { OfferStatus } from "./OfferStatus";

export interface ResyncUpdate {
  syncedToBlock: Promise<number>;
  createdContracts: Promise<CreatedEvent[]>;
  completedContracts: Promise<CompletedEvent[]>;
  cancelledContracts: Promise<CancelledEvent[]>;
  boughtContracts: Promise<BoughtEvent[]>;
  buyerRejectedContracts: Promise<BuyerRejectedEvent[]>;
  changedContracts: Promise<ChangedEvent[]>;
}

export interface OfferDump {
  status: OfferStatus;
  shipsFrom: string;
  seller: string;
  buyer: string;
  price: string;
  title: string;
  category: string;
  attachedFiles: string;
}

export interface EventFn<E extends BlockchainEvent> {
  (event: E, block: number | null): void;
}

export interface RevertFn<E extends BlockchainEvent> {
  (event: E): void;
}

export interface ErrorFn {
  (name: string, message: string): void;
}

export type BlockchainUrl = provider;

export enum CidSearchFound {
  FOUND,
  NOT_FOUND,
  GONE,
}

export type CidSearchResult =
  | [CidSearchFound.NOT_FOUND | CidSearchFound.GONE, null]
  | [CidSearchFound.FOUND, Set<OfferStatus>];

export class Blockchain {
  private web3: Web3;
  private registryContract: Contract;

  constructor(
    registryAddress: string,
    node: BlockchainUrl = "ws://localhost:8546"
  ) {
    let provider: provider;
    if (typeof node !== "string") {
      provider = node;
    } else if (node.startsWith("ws://") || node.startsWith("wss://")) {
      provider = (WebsocketProvider as any)(node, {
        timeout: 30000, // 30 s. WSS timeout for EtherProxy is 60 s.
        reconnect: {
          auto: true,
          delay: 1000,
          maxAttempts: 5,
        },
      });
    } else if (node.startsWith("http://") || node.startsWith("https://")) {
      provider = (HttpProvider as any)(node, {
        keepAlive: true,
      });
    } else {
      provider = node;
    }
    this.web3 = new Web3(provider);
    this.registryContract = new this.web3.eth.Contract(
      OfferRegistryAbi as AbiItem[],
      registryAddress
    );
  }

  public onCreated(
    callback: EventFn<CreatedEvent>,
    onRevert: RevertFn<CreatedEvent>,
    onError: ErrorFn = nopError,
    fromBlock: string | number = "latest"
  ): EventSubscription {
    const subscription = this.registryContract.events[EventEnum.Created]({
      fromBlock,
    })
      .on("data", (data: EventData) =>
        callback(makeCreatedEvent(data.returnValues), data.blockNumber)
      )
      .on("changed", (data: EventData) =>
        onRevert(makeCreatedEvent(data.returnValues))
      )
      .on("error", (error: Error) => onError(error.name, error.message));
    return new SimpleEventSubscription(subscription);
  }

  public onCompleted(
    callback: EventFn<CompletedEvent>,
    onRevert: RevertFn<CompletedEvent>,
    onError: ErrorFn = nopError,
    fromBlock: string | number = "latest"
  ): EventSubscription {
    const subscription = this.registryContract.events[EventEnum.Completed]({
      fromBlock,
    })
      .on("data", (data: EventData) =>
        callback({ offer: data.returnValues.offer }, data.blockNumber)
      )
      .on("changed", (data: EventData) =>
        onRevert({ offer: data.returnValues.offer })
      )
      .on("error", (error: Error) => onError(error.name, error.message));
    return new SimpleEventSubscription(subscription);
  }

  public onCancelled(
    callback: EventFn<CancelledEvent>,
    onRevert: RevertFn<CancelledEvent>,
    onError: ErrorFn = nopError,
    fromBlock: string | number = "latest"
  ): EventSubscription {
    const subscription = this.registryContract.events[EventEnum.Cancelled]({
      fromBlock,
    })
      .on("data", (data: EventData) =>
        callback({ offer: data.returnValues.offer }, data.blockNumber)
      )
      .on("changed", (data: EventData) =>
        onRevert({ offer: data.returnValues.offer })
      )
      .on("error", (error: Error) => onError(error.name, error.message));
    return new SimpleEventSubscription(subscription);
  }

  public onBought(
    callback: EventFn<BoughtEvent>,
    onRevert: RevertFn<BoughtEvent>,
    onError: ErrorFn = nopError,
    fromBlock: string | number = "latest"
  ): EventSubscription {
    const subscription = this.registryContract.events[EventEnum.Bought]({
      fromBlock,
    })
      .on("data", (data: EventData) =>
        callback(
          {
            offer: data.returnValues.offer,
            buyer: data.returnValues.buyer,
          },
          data.blockNumber
        )
      )
      .on("changed", (data: EventData) =>
        onRevert({
          offer: data.returnValues.offer,
          buyer: data.returnValues.buyer,
        })
      )
      .on("error", (error: Error) => onError(error.name, error.message));
    return new SimpleEventSubscription(subscription);
  }

  public onBuyerRejected(
    callback: EventFn<BuyerRejectedEvent>,
    onRevert: RevertFn<BuyerRejectedEvent>,
    onError: ErrorFn = nopError,
    fromBlock: string | number = "latest"
  ): EventSubscription {
    const subscription = this.registryContract.events[EventEnum.BuyerRejected]({
      fromBlock,
    })
      .on("data", (data: EventData) =>
        callback({ offer: data.returnValues.offer }, data.blockNumber)
      )
      .on("changed", (data: EventData) =>
        onRevert({ offer: data.returnValues.offer })
      )
      .on("error", (error: Error) => onError(error.name, error.message));
    return new SimpleEventSubscription(subscription);
  }

  public onChanged(
    callback: EventFn<ChangedEvent>,
    onRevert: RevertFn<ChangedEvent>,
    onError: ErrorFn = nopError,
    fromBlock: string | number = "latest"
  ): EventSubscription {
    let subscriptions = new Array<EventSubscription>();
    for (let { event, objField, ethField } of CHANGE_MAPPING) {
      let subscription = this.registryContract.events[event]({
        fromBlock,
      })
        .on("data", (data: EventData) =>
          callback(
            {
              offer: data.returnValues.offer,
              [objField]: data.returnValues[ethField],
            },
            data.blockNumber
          )
        )
        .on("changed", (data: EventData) =>
          onRevert({
            offer: data.returnValues.offer,
            [objField]: data.returnValues[ethField],
          })
        )
        .on("error", (error: Error) => onError(error.name, error.message));
      subscriptions.push(new SimpleEventSubscription(subscription));
    }
    return new CombinedEventSubscription(subscriptions);
  }

  public async dumpOffer(offer: string): Promise<OfferDump | null> {
    let contract = new this.web3.eth.Contract(OfferAbi as AbiItem[], offer);
    let statusProm = contract.methods[PropertyEnum.currentStatus]().call();
    let shipsFromProm = contract.methods[PropertyEnum.shipsFrom]().call();
    let sellerProm = contract.methods[PropertyEnum.seller]().call();
    let buyerProm = contract.methods[PropertyEnum.buyer]().call();
    let priceProm = contract.methods[PropertyEnum.price]().call();
    let titleProm = contract.methods[PropertyEnum.title]().call();
    let categoryProm = contract.methods[PropertyEnum.category]().call();
    let attachedFilesProm = contract.methods[
      PropertyEnum.attachedFiles
    ]().call();
    return {
      status: await statusProm,
      shipsFrom: await shipsFromProm,
      seller: await sellerProm,
      buyer: await buyerProm,
      price: await priceProm,
      title: await titleProm,
      category: await categoryProm,
      attachedFiles: await attachedFilesProm,
    };
  }

  public resync(fromBlock: string | number = "genesis"): ResyncUpdate {
    let latestBlockPromise = this.web3.eth.getBlockNumber();
    const runQuery = (eventName: EventEnum) =>
      latestBlockPromise.then((toBlock) =>
        this.registryContract.getPastEvents(eventName, {
          fromBlock,
          toBlock,
        })
      );
    const simpleConvert = function (event: EventData): BlockchainEvent {
      return { offer: event.returnValues.offer };
    };

    return {
      syncedToBlock: latestBlockPromise,
      createdContracts: runQuery(EventEnum.Created).then((events) =>
        events.map((event) => makeCreatedEvent(event.returnValues))
      ),
      completedContracts: runQuery(EventEnum.Completed).then((events) =>
        events.map(simpleConvert)
      ),
      cancelledContracts: runQuery(EventEnum.Cancelled).then((events) =>
        events.map(simpleConvert)
      ),
      boughtContracts: runQuery(EventEnum.Bought).then((events) =>
        events.map((event) => {
          return {
            offer: event.returnValues.offer,
            buyer: event.returnValues.buyer,
          };
        })
      ),
      buyerRejectedContracts: runQuery(EventEnum.BuyerRejected).then((events) =>
        events.map(simpleConvert)
      ),
      changedContracts: this.changedForResync(runQuery),
    };
  }

  private async changedForResync(
    runQuery: (eventName: EventEnum) => Promise<EventData[]>
  ): Promise<ChangedEvent[]> {
    const fetchChanged = async function (
      eventName: EventEnum,
      objKey: keyof ChangedEvent,
      ethKey: string
    ): Promise<ChangedEvent[]> {
      const events = await runQuery(eventName);
      return events.map((event) => {
        return {
          offer: event.returnValues.offer,
          [objKey]: event.returnValues[ethKey],
        };
      });
    };
    let waitingPromises = new Array<Promise<ChangedEvent[]>>();
    for (let { event, objField, ethField } of CHANGE_MAPPING) {
      waitingPromises.push(fetchChanged(event, objField, ethField));
    }
    const events = await Promise.all(waitingPromises);
    // Flatten array. events.flat() could also be used, but that requires ESNext.
    return new Array<ChangedEvent>().concat(...events);
  }

  /**
   * Check if a CID is or has been on the blockchain and, if it can still be found,
   * in which states are the offers that reference it.
   *
   * @remarks
   * Take in mind that, while most CIDs will only be associated will one offer,
   * Some may be referenced by more than one offer, and such behaviour is expected,
   * in special cases (empty offer, offer with only empty description...).
   *
   * @param cid - CID to search.
   *    This CID will be used as a filter on `newCID` for the `AttachedFilesChanged` event.
   */
  public async findCid(cid: string): Promise<CidSearchResult> {
    let events = this.registryContract.getPastEvents(
      EventEnum.AttachedFilesChanged,
      {
        filter: {
          newCID: cid,
        },
      }
    );
    let existed = false;
    let statusSet = new Set<OfferStatus>();
    for (let event of await events) {
      existed = true;
      let contract = new this.web3.eth.Contract(
        OfferAbi as AbiItem[],
        event.returnValues.offer
      );
      let currentAF = contract.methods[PropertyEnum.attachedFiles]().call();
      let status = contract.methods[PropertyEnum.currentStatus]().call();
      if ((await currentAF) == cid) {
        statusSet.add(await status);
      }
    }
    if (!existed) {
      return [CidSearchFound.NOT_FOUND, null];
    } else if (statusSet.size === 0) {
      return [CidSearchFound.GONE, null];
    } else {
      return [CidSearchFound.FOUND, statusSet];
    }
  }
}

function makeCreatedEvent(data: any): CreatedEvent {
  return {
    offer: data.offer,
    seller: data.seller,
    title: data.title,
    price: data.price,
    category: data.category,
    shipsFrom: data.shipsFrom,
    attachedFiles: data.attachedFiles,
  };
}

function nopError(_e: string, _m: string) {}

interface ChangeMap {
  event: EventEnum;
  objField: keyof ChangedEvent;
  ethField: string;
}

const CHANGE_MAPPING: ChangeMap[] = [
  {
    event: EventEnum.TitleChanged,
    objField: "title",
    ethField: "newTitle",
  },
  {
    event: EventEnum.PriceChanged,
    objField: "price",
    ethField: "newPrice",
  },
  {
    event: EventEnum.CategoryChanged,
    objField: "category",
    ethField: "newCategory",
  },
  {
    event: EventEnum.ShipsFromChanged,
    objField: "shipsFrom",
    ethField: "newShipsFrom",
  },
  {
    event: EventEnum.AttachedFilesChanged,
    objField: "attachedFiles",
    ethField: "newCID",
  },
];
