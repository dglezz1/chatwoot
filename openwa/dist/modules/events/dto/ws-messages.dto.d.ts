export type WSClientMessageType = 'subscribe' | 'unsubscribe' | 'ping';
export type WSServerMessageType = 'subscribed' | 'unsubscribed' | 'event' | 'error' | 'pong';
export declare const SUBSCRIBABLE_EVENTS: readonly ["message.received", "message.sent", "message.ack", "message.revoked", "message.reaction", "session.status", "session.qr", "session.authenticated", "session.disconnected"];
export type SubscribableEvent = (typeof SUBSCRIBABLE_EVENTS)[number] | '*';
export interface WSSubscribeRequest {
    type: 'subscribe';
    sessionId: string;
    events: string[];
    requestId?: string;
}
export interface WSUnsubscribeRequest {
    type: 'unsubscribe';
    sessionId: string;
    requestId?: string;
}
export interface WSPingRequest {
    type: 'ping';
    requestId?: string;
}
export type WSClientMessage = WSSubscribeRequest | WSUnsubscribeRequest | WSPingRequest;
export interface WSSubscribedResponse {
    type: 'subscribed';
    sessionId: string;
    events: string[];
    requestId?: string;
    timestamp: string;
}
export interface WSUnsubscribedResponse {
    type: 'unsubscribed';
    sessionId: string;
    requestId?: string;
    timestamp: string;
}
export interface WSEventMessage {
    type: 'event';
    payload: {
        event: string;
        sessionId: string;
        data: unknown;
    };
    timestamp: string;
}
export interface WSErrorResponse {
    type: 'error';
    code: string;
    message: string;
    requestId?: string;
    timestamp: string;
}
export interface WSPongResponse {
    type: 'pong';
    requestId?: string;
    timestamp: string;
}
export type WSServerMessage = WSSubscribedResponse | WSUnsubscribedResponse | WSEventMessage | WSErrorResponse | WSPongResponse;
export declare function buildRoomName(sessionId: string, event: string): string;
export declare function parseRoomName(room: string): {
    sessionId: string;
    event: string;
} | null;
