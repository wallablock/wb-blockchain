import { BlockchainEvent } from "./events";
import { OfferDump } from "./OfferDump";
import Web3 from "web3";
import { OfferStatus } from "./OfferStatus";

interface Mappables extends BlockchainEvent, OfferDump {} // Keeps type-checker happy

type Mappers = {
  [K in keyof Mappables]: (bdata: unknown) => Mappables[K];
};

function castOrDie(bdata: unknown): string {
  if (typeof bdata === "string") {
    return bdata;
  } else {
    throw new Error(
      `Unexpected type: ${typeof bdata}; expecting string from blockchain`
    );
  }
}

function cvtToUtf8(bdata: unknown): string {
  let sdata = castOrDie(bdata);
  if (sdata.startsWith("0x")) {
    return Web3.utils.hexToUtf8(sdata);
  } else {
    return sdata;
  }
}

function cvtToAscii(bdata: unknown): string {
  let sdata = castOrDie(bdata);
  if (sdata.startsWith("0x")) {
    return Web3.utils.hexToAscii(sdata);
  } else {
    return sdata;
  }
}

function cvtToStatus(bdata: unknown): OfferStatus {
  switch (typeof bdata) {
    case "string":
      for (let status in OfferStatus) {
        let key = status as keyof typeof OfferStatus;
        let val = OfferStatus[key];
        if (bdata === key || bdata === val) {
          return val;
        }
      }
      throw new Error(`Unexpected OfferStatus value: ${bdata}`);
    case "number":
      return cvtToStatus(bdata.toString());
    default:
      throw new Error(
        `Unexpected type: ${typeof bdata}; expecting string or number from blockchain`
      );
  }
}

export const MAPPERS: Readonly<Mappers> = {
  offer: (x) => x as string, // Checking is not needed, but saves work-arounds
  seller: castOrDie,
  title: castOrDie,
  price: castOrDie,
  category: cvtToUtf8,
  shipsFrom: cvtToAscii,
  attachedFiles: cvtToAscii,
  buyer: castOrDie,
  status: cvtToStatus,
};
