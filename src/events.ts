export interface CreatedEvent {
    offer: string,
    seller: string,
    title: string,
    price: string,
    category: string,
    shipsFrom: string
}

export function makeCreatedEvent(offer: string, data: any): CreatedEvent {
    return {
        offer,
        seller: data.seller,
        title: data.title,
        price: data.price,
        category: data.category,
        shipsFrom: data.shipsFrom
    }
}

export interface CompletedEvent {
    offer: string
}

export interface CancelledEvent {
    offer: string
}
