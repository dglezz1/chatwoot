import type { ToolDescriptor } from './tool-descriptor';
export declare class ToolRegistryService {
    private readonly byName;
    constructor(tools: ToolDescriptor[]);
    list(opts?: {
        readOnly?: boolean;
    }): ToolDescriptor[];
    get(name: string): ToolDescriptor | undefined;
}
