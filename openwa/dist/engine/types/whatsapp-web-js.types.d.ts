import { Chat, Client, Message } from 'whatsapp-web.js';
export interface SerializedWid {
    _serialized?: string;
}
export interface GroupMetadataRaw {
    parentGroup?: SerializedWid | string | null;
    linkedParentGroup?: SerializedWid | string | null;
    linkedParent?: SerializedWid | string | null;
}
export interface GroupChat extends Omit<Chat, 'isReadOnly' | 'getLabels'> {
    participants: Array<{
        id: {
            _serialized: string;
            user: string;
        };
        name?: string;
        isAdmin: boolean;
        isSuperAdmin: boolean;
    }>;
    description?: string;
    owner?: {
        _serialized: string;
    };
    createdAt?: number;
    isReadOnly?: boolean;
    isAnnounce?: boolean;
    groupMetadata?: GroupMetadataRaw;
    addParticipants(ids: string[]): Promise<void>;
    removeParticipants(ids: string[]): Promise<void>;
    promoteParticipants(ids: string[]): Promise<void>;
    demoteParticipants(ids: string[]): Promise<void>;
    leave(): Promise<void>;
    setSubject(subject: string): Promise<void>;
    setDescription(desc: string): Promise<void>;
    getLabels(): Promise<Array<{
        id: string;
        name: string;
        hexColor: string;
    }>>;
    addLabel(id: string): Promise<void>;
    removeLabel(id: string): Promise<void>;
    getInviteCode(): Promise<string>;
    revokeInvite(): Promise<string>;
}
export interface MessageWithReactions extends Omit<Message, 'hasReaction' | 'getReactions' | 'react'> {
    react(emoji: string): Promise<void>;
    hasReaction?: boolean;
    getReactions(): Promise<Array<{
        id: string;
        senders: Array<{
            senderId: string;
            reaction: string;
            timestamp: number;
        }>;
    }>>;
}
export interface BusinessClient extends Omit<Client, 'subscribeToChannel' | 'unsubscribeFromChannel' | 'getLabels' | 'getLabelById' | 'getChannels'> {
    getLabels(): Promise<Array<{
        id: string;
        name: string;
        hexColor: string;
    }>>;
    getLabelById(id: string): Promise<{
        id: string;
        name: string;
        hexColor: string;
    } | null>;
    getChannels(): Promise<WwjsChannelData[]>;
    subscribeToChannel(inviteCode: string): Promise<WwjsChannelData>;
    unsubscribeFromChannel(id: string): Promise<void>;
}
export interface WwjsChannelData {
    id: {
        _serialized: string;
    } | string;
    name?: string;
    description?: string;
    inviteCode?: string;
    subscriberCount?: number;
    verified?: boolean;
    fetchMessages(opts: {
        limit: number;
    }): Promise<WwjsChannelMessage[]>;
}
export interface WwjsChannelMessage {
    id: {
        _serialized: string;
    } | string;
    body?: string;
    type?: string;
    timestamp?: number;
    hasMedia?: boolean;
    mediaUrl?: string;
}
export interface GroupCreateResult {
    gid: {
        _serialized: string;
    };
}
