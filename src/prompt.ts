import { Maybe } from '@barrelreaper/src/types';
import * as readline from 'node:readline';

export const parseBoolean = (input: string): boolean => {
    return ['y', 'yes', '1', 'true'].includes(input.toLowerCase());
};

export interface PromptConfig<T, Required extends boolean> {
    prompt: string;
    required?: Required;
    validate?: (value: string) => boolean;
    transform?: (value: string) => T;
}

type PromptResult<T extends PromptConfig<any, any>> =
    T extends PromptConfig<infer Res, infer Required> ? (Required extends true ? Res : Maybe<Res>) : never;

export class Prompt {
    private rl: readline.Interface;

    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
    }

    async ask(message: string, clear?: boolean, color: string = '\x1b[36m'): Promise<string> {
        return new Promise((resolve) => {
            if (clear) this.clearLine();
            this.rl.question(`${color}? ${message}:\x1b[0m `, (answer) => {
                resolve(answer.trim());
            });
        });
    }

    async prompt<T = string, Required extends boolean = false, Res = PromptResult<PromptConfig<T, Required>>>(
        config: PromptConfig<T, Required>,
    ): Promise<Res> {
        let clear = false;

        while (true) {
            const promptText = !config.required ? `${config.prompt} (optional)` : config.prompt;

            const input = await this.ask(promptText, clear);
            clear = true;

            if (!input) {
                if (!config.required) return undefined as Res;
                else continue;
            }

            if (config.validate && !config.validate(input)) continue;
            return (config.transform ? config.transform(input) : input) as Res;
        }
    }

    async confirm(message: string, color?: string): Promise<boolean> {
        while (true) {
            const response = await this.ask(`${message} (y/n)`, false, color);
            const normalized = response.toLowerCase();
            if (['y', 'yes', 'n', 'no'].includes(normalized)) return parseBoolean(response);
            else this.clearLine();
        }
    }

    private clearLine(): void {
        process.stdout.write('\x1b[1A');
        process.stdout.write('\r\x1b[K');
    }

    close(): void {
        this.rl.close();
    }
}
