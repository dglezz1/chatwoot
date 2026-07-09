"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertBase64WithinMediaCap = assertBase64WithinMediaCap;
const common_1 = require("@nestjs/common");
const inbound_media_cap_1 = require("../../engine/adapters/inbound-media-cap");
function assertBase64WithinMediaCap(base64) {
    if (!base64) {
        return;
    }
    const maxBytes = (0, inbound_media_cap_1.inboundMediaMaxBytes)();
    if (Buffer.byteLength(base64, 'base64') > maxBytes) {
        throw new common_1.PayloadTooLargeException(`Base64 media exceeds the maximum allowed size of ${maxBytes} bytes`);
    }
}
//# sourceMappingURL=media-cap.util.js.map