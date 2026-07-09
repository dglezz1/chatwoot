export type FilterOperator = 'is' | 'isNot' | 'contains' | 'equals';
export type FieldKind = 'id' | 'idArray' | 'text' | 'enum' | 'boolean';
export interface WebhookFilterCondition {
    field: string;
    operator: FilterOperator;
    value: string | string[] | boolean;
    caseSensitive?: boolean;
}
export interface WebhookFilters {
    conditions: WebhookFilterCondition[];
}
export interface FieldDefinition {
    field: string;
    kind: FieldKind;
    operators: FilterOperator[];
    resolve: (data: Record<string, unknown>) => unknown;
    enumValues?: readonly string[];
}
export declare const MESSAGE_TYPES: readonly ["text", "image", "video", "audio", "voice", "document", "sticker", "location", "contact", "call", "revoked", "masked", "unknown"];
export declare const MAX_CONDITIONS = 20;
export declare const MAX_VALUES_PER_CONDITION = 100;
export declare const MAX_TEXT_VALUE_LENGTH = 1000;
export declare const FILTER_FIELDS: Record<string, FieldDefinition[]>;
export declare function eventFamily(event: string): string;
export declare function getFieldDefinition(family: string, field: string): FieldDefinition | undefined;
export declare function findFieldDefinition(field: string): FieldDefinition | undefined;
