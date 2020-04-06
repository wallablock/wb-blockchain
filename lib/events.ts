export interface BlockchainEvent {
    offer: string
}

export interface CreatedEvent extends BlockchainEvent {
    seller: string,
    title: string,
    price: string,
    category: string,
    shipsFrom: string
}

export interface CompletedEvent extends BlockchainEvent {}

export interface CancelledEvent extends BlockchainEvent {}

export interface BoughtEvent extends BlockchainEvent {
    buyer: string
}

export interface BuyerRejectedEvent extends BlockchainEvent {}

export interface ChangedEvent extends BlockchainEvent {
    title?: string,
    price?: string,
    category?: string,
    shipsFrom?: string
}
