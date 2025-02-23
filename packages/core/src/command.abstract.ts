export abstract class Command<P = unknown, R = unknown> {
    abstract command: string;
    abstract schema: Record<string, unknown>;
    abstract instruction: string;
    abstract execute(params: P): Promise<R>;
    constructor() {}
}
