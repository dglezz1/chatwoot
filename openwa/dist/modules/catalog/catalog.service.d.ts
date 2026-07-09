import { SessionService } from '../session/session.service';
import type { Catalog, Product, PaginatedProducts, MessageResult } from '../../engine/interfaces/whatsapp-engine.interface';
export declare class CatalogService {
    private readonly sessionService;
    constructor(sessionService: SessionService);
    getCatalog(sessionId: string): Promise<Catalog | null>;
    getProducts(sessionId: string, page?: number, limit?: number): Promise<PaginatedProducts>;
    getProduct(sessionId: string, productId: string): Promise<Product | null>;
    sendProduct(sessionId: string, chatId: string, productId: string, body?: string): Promise<MessageResult>;
    sendCatalog(sessionId: string, chatId: string, body?: string): Promise<MessageResult>;
}
