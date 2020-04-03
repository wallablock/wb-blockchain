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

}
