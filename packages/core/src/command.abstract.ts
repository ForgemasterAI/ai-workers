
export abstract class Command {
    abstract command: string;
    abstract schema: Record<string, any>;
    abstract instruction: string;

    abstract execute(params: any): Promise<any>;
    // enforce params JSON schema to be defined
    constructor() {}
}
