export interface OnWebhookSubscribeDeps {
    pluginId: string;
    declaredRoutes: Set<string>;
    hasPermission: boolean;
    subscribed: Set<string>;
    maxRoutes: number;
    warn: (message: string, meta: Record<string, unknown>) => void;
}
export declare function makeOnWebhookSubscribe(deps: OnWebhookSubscribeDeps): (route: string) => void;
