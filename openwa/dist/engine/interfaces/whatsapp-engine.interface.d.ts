export declare enum EngineStatus {
    DISCONNECTED = "disconnected",
    INITIALIZING = "initializing",
    QR_READY = "qr_ready",
    AUTHENTICATING = "authenticating",
    READY = "ready",
    FAILED = "failed"
}
export interface MessageResult {
    id: string;
    timestamp: number;
}
export interface MediaInput {
    mimetype: string;
    data: Buffer | string;
    filename?: string;
    caption?: string;
    mentions?: string[];
    ptt?: boolean;
}
export type MessageType = 'text' | 'image' | 'video' | 'audio' | 'voice' | 'document' | 'sticker' | 'location' | 'contact' | 'poll' | 'call' | 'revoked' | 'masked' | 'unknown';
export interface IncomingMessage {
    id: string;
    from: string;
    to: string;
    chatId: string;
    body: string;
    type: MessageType;
    timestamp: number;
    fromMe: boolean;
    isGroup: boolean;
    isStatusBroadcast?: boolean;
    ephemeralDuration?: number;
    author?: string;
    mentionedIds?: string[];
    call?: {
        video: boolean;
        missed: boolean;
    };
    isLidSender?: boolean;
    senderPhone?: string | null;
    contact?: MessageContact;
    media?: {
        mimetype: string;
        filename?: string;
        data?: string;
        omitted?: boolean;
        sizeBytes?: number;
    };
    quotedMessage?: {
        id: string;
        body: string;
    };
    location?: {
        latitude: number;
        longitude: number;
        description?: string;
        address?: string;
        url?: string;
    };
}
export interface MessageContact {
    id?: string;
    number?: string;
    name?: string;
    pushName?: string;
    shortName?: string;
    type?: string;
    isMyContact?: boolean;
    isWAContact?: boolean;
    isBusiness?: boolean;
    isEnterprise?: boolean;
    verifiedName?: string;
    verifiedLevel?: number;
    isBlocked?: boolean;
    labels?: string[];
}
export interface Contact {
    id: string;
    name?: string;
    pushName?: string;
    number: string;
    isMyContact: boolean;
    isBlocked: boolean;
    profilePicUrl?: string;
}
export interface Group {
    id: string;
    name: string;
    participantsCount?: number;
    isAdmin?: boolean;
    linkedParentJID?: string | null;
}
export interface GroupParticipant {
    id: string;
    number: string;
    name?: string;
    isAdmin: boolean;
    isSuperAdmin: boolean;
}
export interface GroupInfo {
    id: string;
    name: string;
    description?: string;
    owner?: string;
    createdAt?: number;
    participants: GroupParticipant[];
    isReadOnly?: boolean;
    isAnnounce?: boolean;
    linkedParentJID?: string | null;
}
export interface ContactCard {
    name: string;
    number: string;
}
export interface LocationInput {
    latitude: number;
    longitude: number;
    description?: string;
    address?: string;
}
export interface PollInput {
    name: string;
    options: string[];
    allowMultipleAnswers?: boolean;
}
export interface ReactionSender {
    senderId: string;
    emoji: string;
    timestamp: number;
}
export interface MessageReaction {
    emoji: string;
    senders: ReactionSender[];
}
export interface Label {
    id: string;
    name: string;
    hexColor: string;
}
export interface Status {
    id: string;
    contact: {
        id: string;
        name?: string;
        pushName?: string;
    };
    type: 'text' | 'image' | 'video';
    caption?: string;
    mediaUrl?: string;
    backgroundColor?: string;
    font?: number;
    timestamp: Date;
    expiresAt: Date;
}
export interface StatusPostOptions {
    recipients: string[];
    backgroundColor?: string;
    font?: number;
    caption?: string;
}
export interface StatusResult {
    statusId: string;
    timestamp: Date;
    expiresAt: Date;
}
export interface Channel {
    id: string;
    name: string;
    description?: string;
    inviteCode?: string;
    subscriberCount?: number;
    picture?: string;
    verified?: boolean;
    createdAt?: number;
}
export interface ChannelMessage {
    id: string;
    body: string;
    timestamp: number;
    hasMedia: boolean;
    mediaUrl?: string;
}
export interface Catalog {
    id: string;
    name: string;
    description?: string;
    productCount: number;
    url: string;
}
export interface Product {
    id: string;
    name: string;
    description?: string;
    price: number;
    currency: string;
    priceFormatted: string;
    imageUrl?: string;
    url: string;
    isAvailable: boolean;
    retailerId?: string;
}
export interface ProductQueryOptions {
    page?: number;
    limit?: number;
}
export interface PaginatedProducts {
    products: Product[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
export interface ChatSummary {
    id: string;
    name: string;
    isGroup: boolean;
    unreadCount: number;
    timestamp: number;
    lastMessage?: string;
}
export type ChatState = 'typing' | 'recording' | 'paused';
export type DeliveryStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
export interface RevokedMessage {
    id: string;
    revokedId?: string;
    chatId: string;
    from: string;
    to: string;
    type: 'revoked';
    body: '';
    timestamp: number;
}
export interface ReactionEvent {
    messageId: string;
    chatId: string;
    reaction: string;
    senderId: string;
}
export interface EngineEventCallbacks {
    onQRCode?: (qr: string) => void;
    onReady?: (phone: string, pushName: string) => void;
    onMessage?: (message: IncomingMessage) => void;
    onMessageCreate?: (message: IncomingMessage) => void;
    onMessageAck?: (messageId: string, status: DeliveryStatus) => void;
    onMessageRevoked?: (message: RevokedMessage) => void;
    onMessageReaction?: (event: ReactionEvent) => void;
    onHistoryMessages?: (messages: IncomingMessage[]) => void;
    onDisconnected?: (reason: string) => void;
    onStateChanged?: (state: EngineStatus) => void;
    onError?: (reason: string) => void;
}
export interface IWhatsAppEngine {
    initialize(callbacks: EngineEventCallbacks): Promise<void>;
    disconnect(): Promise<void>;
    logout(): Promise<void>;
    destroy(): Promise<void>;
    forceDestroy(): Promise<void>;
    getStatus(): EngineStatus;
    getQRCode(): string | null;
    requestPairingCode(phoneNumber: string): Promise<string>;
    getPhoneNumber(): string | null;
    getPushName(): string | null;
    sendTextMessage(chatId: string, text: string, mentions?: string[]): Promise<MessageResult>;
    sendImageMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
    sendVideoMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
    sendAudioMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
    sendDocumentMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
    sendLocationMessage(chatId: string, location: LocationInput): Promise<MessageResult>;
    sendContactMessage(chatId: string, contact: ContactCard): Promise<MessageResult>;
    sendStickerMessage(chatId: string, media: MediaInput): Promise<MessageResult>;
    sendPollMessage(chatId: string, poll: PollInput): Promise<MessageResult>;
    replyToMessage(chatId: string, quotedMsgId: string, text: string): Promise<MessageResult>;
    forwardMessage(fromChatId: string, toChatId: string, messageId: string): Promise<MessageResult>;
    reactToMessage(chatId: string, messageId: string, emoji: string): Promise<void>;
    getMessageReactions(chatId: string, messageId: string): Promise<MessageReaction[]>;
    getContacts(): Promise<Contact[]>;
    getContactById(contactId: string): Promise<Contact | null>;
    checkNumberExists(number: string): Promise<boolean>;
    getNumberId(number: string): Promise<string | null>;
    resolveContactPhone(contactId: string): Promise<string | null>;
    getGroups(): Promise<Group[]>;
    getGroupInfo(groupId: string): Promise<GroupInfo | null>;
    createGroup(name: string, participants: string[]): Promise<Group>;
    addParticipants(groupId: string, participants: string[]): Promise<void>;
    removeParticipants(groupId: string, participants: string[]): Promise<void>;
    promoteParticipants(groupId: string, participants: string[]): Promise<void>;
    demoteParticipants(groupId: string, participants: string[]): Promise<void>;
    leaveGroup(groupId: string): Promise<void>;
    setGroupSubject(groupId: string, subject: string): Promise<void>;
    setGroupDescription(groupId: string, description: string): Promise<void>;
    getGroupInviteCode(groupId: string): Promise<string>;
    revokeGroupInviteCode(groupId: string): Promise<string>;
    deleteMessage(chatId: string, messageId: string, forEveryone?: boolean): Promise<void>;
    getChatHistory(chatId: string, limit?: number, includeMedia?: boolean): Promise<IncomingMessage[]>;
    getProfilePicture(contactId: string): Promise<string | null>;
    blockContact(contactId: string): Promise<void>;
    unblockContact(contactId: string): Promise<void>;
    getLabels(): Promise<Label[]>;
    getLabelById(labelId: string): Promise<Label | null>;
    getChatLabels(chatId: string): Promise<Label[]>;
    addLabelToChat(chatId: string, labelId: string): Promise<void>;
    removeLabelFromChat(chatId: string, labelId: string): Promise<void>;
    getSubscribedChannels(): Promise<Channel[]>;
    getChannelById(channelId: string): Promise<Channel | null>;
    subscribeToChannel(inviteCode: string): Promise<Channel>;
    unsubscribeFromChannel(channelId: string): Promise<void>;
    getChannelMessages(channelId: string, limit?: number): Promise<ChannelMessage[]>;
    getContactStatuses(): Promise<Status[]>;
    getContactStatus(contactId: string): Promise<Status[]>;
    postTextStatus(text: string, options: StatusPostOptions): Promise<StatusResult>;
    postImageStatus(media: MediaInput, options: StatusPostOptions): Promise<StatusResult>;
    postVideoStatus(media: MediaInput, options: StatusPostOptions): Promise<StatusResult>;
    deleteStatus(statusId: string): Promise<void>;
    getCatalog(): Promise<Catalog | null>;
    getProducts(options?: ProductQueryOptions): Promise<PaginatedProducts>;
    getProduct(productId: string): Promise<Product | null>;
    sendProduct(chatId: string, productId: string, body?: string): Promise<MessageResult>;
    sendCatalog(chatId: string, body?: string): Promise<MessageResult>;
    getChats(): Promise<ChatSummary[]>;
    sendSeen(chatId: string): Promise<boolean>;
    markUnread(chatId: string): Promise<boolean>;
    deleteChat(chatId: string): Promise<boolean>;
    sendChatState(chatId: string, state: ChatState): Promise<void>;
}
