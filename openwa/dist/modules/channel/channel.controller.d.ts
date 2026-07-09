import { ChannelService } from './channel.service';
import { SubscribeChannelDto } from './dto/subscribe-channel.dto';
export declare class ChannelController {
    private readonly channelService;
    constructor(channelService: ChannelService);
    findAll(sessionId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Channel[]>;
    findOne(sessionId: string, channelId: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Channel>;
    getMessages(sessionId: string, channelId: string, limit?: string): Promise<import("../../engine/interfaces/whatsapp-engine.interface").ChannelMessage[]>;
    subscribe(sessionId: string, body: SubscribeChannelDto): Promise<import("../../engine/interfaces/whatsapp-engine.interface").Channel>;
    unsubscribe(sessionId: string, channelId: string): Promise<{
        success: boolean;
    }>;
}
