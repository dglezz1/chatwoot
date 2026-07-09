import { SessionService } from '../session/session.service';
export declare class ChannelService {
    private readonly sessionService;
    constructor(sessionService: SessionService);
    private getEngine;
    getSubscribedChannels(sessionId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Channel[]>;
    getChannelById(sessionId: string, channelId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Channel>;
    getChannelMessages(sessionId: string, channelId: string, limit?: number): Promise<import("../../engine/interfaces/whatsapp-engine.interface").ChannelMessage[]>;
    subscribeToChannel(sessionId: string, inviteCode: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Channel>;
    unsubscribeFromChannel(sessionId: string, channelId: string): Promise<void>;
}
