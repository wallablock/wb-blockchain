export enum Status {
  WAITING_BUYER = "0",
  PENDING_CONFIRMATION = "1",
  COMPLETED = "2",
  CANCELLED = "3",
}

export const enum Constant {
  MIN_PRICE = "MIN_PRICE",
  SELLER_DEPOSIT_MULTIPLIER = "SELLER_DEPOSIT_MULTIPLIER",
  BUYER_DEPOSIT_MULTIPLIER = "BUYER_DEPOSIT_MULTIPLIER",
}

export const enum Property {
  currentStatus = "currentStatus",
  creationDate = "creationDate",
  purchaseDate = "purchaseDate",
  confirmationDate = "confirmationDate",
  shipsFrom = "shipsFrom",
  seller = "seller",
  buyer = "buyer",
  price = "price",
  title = "title",
  category = "category",
  attachedFiles = "attachedFiles",
  pendingWithdrawals = "pendingWithdrawals",
}

export const enum Event {
  Created = "Created",
  TitleChanged = "TitleChanged",
  AttachedFilesChanged = "AttachedFilesChanged",
  PriceChanged = "PriceChanged",
  CategoryChanged = "CategoryChanged",
  ShipsFromChanged = "ShipsFromChanged",
  Bought = "Bought",
  BuyerRejected = "BuyerRejected",
  Completed = "Completed",
  Cancelled = "Cancelled",
}

export const enum Function {
  withdraw = "withdraw",
  getContactInfo = "getContactInfo",
  setAttachedFiles = "setAttachedFiles",
  setPrice = "setPrice",
  setTitle = "setTitle",
  setCategory = "setCategory",
  setShipsFrom = "setShipsFrom",
  buy = "buy",
  confirm = "confirm",
  rejectBuyer = "rejectBuyer",
  cancel = "cancel",
}

export const enum View {
  buyerDeposit = "buyerDeposit",
  sellerDeposit = "sellerDeposit",
  buyerDepositWithPayment = "buyerDepositWithPayment",
  sellerDepositWithPayment = "sellerDepositWithPayment",
}

export type Callable = Constant | Property | Function | View;
