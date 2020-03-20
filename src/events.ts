export interface CreatedEvent {
    offer: string,
    seller: string,
    title: string,
    price: string, // string?
    category: string,
    shipsFrom: string // string?
}

export interface CompletedEvent {
    offer: string
}

export interface CancelledEvent {
    offer: string
}
