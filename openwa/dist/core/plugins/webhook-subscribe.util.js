"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.makeOnWebhookSubscribe = makeOnWebhookSubscribe;
function makeOnWebhookSubscribe(deps) {
    let unknownRouteWarned = false;
    return (route) => {
        if (!deps.hasPermission)
            return;
        if (!deps.declaredRoutes.has(route)) {
            if (!unknownRouteWarned) {
                unknownRouteWarned = true;
                deps.warn(`Sandboxed plugin ${deps.pluginId} subscribed to an undeclared ingress route; ignoring`, {
                    pluginId: deps.pluginId,
                    route,
                    action: 'sandbox_unknown_ingress_route',
                });
            }
            return;
        }
        if (deps.subscribed.has(route))
            return;
        if (deps.subscribed.size >= deps.maxRoutes)
            return;
        deps.subscribed.add(route);
    };
}
//# sourceMappingURL=webhook-subscribe.util.js.map