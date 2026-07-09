import { RedriveService } from './redrive.service';
export declare class RedriveController {
    private readonly redrive;
    constructor(redrive: RedriveService);
    redriveInstance(pluginId: string, instanceId: string): Promise<{
        redriven: number;
    }>;
}
