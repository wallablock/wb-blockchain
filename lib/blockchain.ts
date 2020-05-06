import Web3 from "web3";
import { Contract, EventData } from "web3-eth-contract";
import { provider } from "web3-core/types";
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
  Status,
} from "./blockchain-names";

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
  status: Status;
  shipsFrom: string;
  seller: string;
  buyer: string;
  price: string;
  title: string;
  category: string;
  attachedFiles: string;
}

export type BlockchainUrl = provider;

export enum CidSearchResult {
  FOUND,
  NOT_FOUND,
  GONE,
}

export class Blockchain {
  private web3: Web3;
  private registryContract: Contract;

  constructor(registryAddress: string, node: BlockchainUrl = "ws://localhost:8545") {
    this.web3 = new Web3(node);
    this.registryContract = new this.web3.eth.Contract(OfferRegistryAbi as AbiItem[], registryAddress);
  }

  public onCreated(
    callback: (event: CreatedEvent) => void,
    onRevert: (event: CreatedEvent) => void,
    onError: (name: string, message: string) => void = nopError,
    fromBlock?: string | number
  ): EventSubscription {
    const subscription = this.registryContract.events[EventEnum.Created]({
      fromBlock,
    })
      .on("data", (data: EventData) =>
        callback(makeCreatedEvent(data.returnValues))
      )
      .on("changed", (data: EventData) =>
        onRevert(makeCreatedEvent(data.returnValues))
      )
      .on("error", (error: Error) => onError(error.name, error.message));
    return new SimpleEventSubscription(subscription);
  }

  public onCompleted(
    callback: (event: CompletedEvent) => void,
    onRevert: (event: CompletedEvent) => void,
    onError: (name: string, message: string) => void = nopError,
    fromBlock?: string | number
  ): EventSubscription {
    const subscription = this.registryContract.events[EventEnum.Completed]({
      fromBlock,
    })
      .on("data", (data: EventData) => callback({ offer: data.returnValues.offer }))
      .on("changed", (data: EventData) => onRevert({ offer: data.returnValues.offer }))
      .on("error", (error: Error) => onError(error.name, error.message));
    return new SimpleEventSubscription(subscription);
  }

  public onCancelled(
    callback: (event: CancelledEvent) => void,
    onRevert: (event: CancelledEvent) => void,
    onError: (name: string, message: string) => void = nopError,
    fromBlock?: string | number
  ): EventSubscription {
    const subscription = this.registryContract.events[EventEnum.Cancelled]({
      fromBlock,
    })
      .on("data", (data: EventData) => callback({ offer: data.returnValues.offer }))
      .on("changed", (data: EventData) => onRevert({ offer: data.returnValues.offer }))
      .on("error", (error: Error) => onError(error.name, error.message));
    return new SimpleEventSubscription(subscription);
  }

  public onBought(
    callback: (event: BoughtEvent) => void,
    onRevert: (event: BoughtEvent) => void,
    onError: (name: string, message: string) => void = nopError,
    fromBlock?: string | number
  ): EventSubscription {
    const subscription = this.registryContract.events[EventEnum.Bought]({
      fromBlock,
    })
      .on("data", (data: EventData) =>
        callback({
          offer: data.returnValues.offer,
          buyer: data.returnValues.buyer,
        })
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
    callback: (event: BuyerRejectedEvent) => void,
    onRevert: (event: BuyerRejectedEvent) => void,
    onError: (name: string, message: string) => void = nopError,
    fromBlock?: string | number
  ): EventSubscription {
    const subscription = this.registryContract.events[EventEnum.BuyerRejected]({
      fromBlock,
    })
      .on("data", (data: EventData) => callback({ offer: data.returnValues.offer }))
      .on("changed", (data: EventData) => onRevert({ offer: data.returnValues.offer }))
      .on("error", (error: Error) => onError(error.name, error.message));
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
      let subscription = this.registryContract.events[event]({
        fromBlock,
      })
        .on("data", (data: EventData) =>
          callback({
            offer: data.returnValues.offer,
            [objField]: data.returnValues[ethField],
          })
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

  public resync(fromBlock?: string | number): ResyncUpdate {
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
        events.map((event) =>
          makeCreatedEvent(event.returnValues)
        )
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
    for (let event of await events) {
      existed = true;
      let contract = new this.web3.eth.Contract(OfferAbi as AbiItem[], event.returnValues.offer);
      let currentAF = contract.methods[PropertyEnum.attachedFiles]().call();
      if (currentAF === cid) {
        return CidSearchResult.FOUND;
      }
    }
    if (existed) {
      return CidSearchResult.GONE;
    } else {
      return CidSearchResult.NOT_FOUND;
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
