import { OfferStatus } from "./OfferStatus";
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
