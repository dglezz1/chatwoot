declare class StatusMediaInput {
    url?: string;
    base64?: string;
    mimetype?: string;
}
export declare class SendImageStatusDto {
    image: StatusMediaInput;
    caption?: string;
    recipients: string[];
}
export declare class SendVideoStatusDto {
    video: StatusMediaInput;
    caption?: string;
    recipients: string[];
}
export {};
