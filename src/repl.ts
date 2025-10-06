import { Prompt, parseBoolean } from './prompt';
import { Std } from './std';
import { BarrelReaperArgs } from './types';

const validateGlob = (value: string) => value.trim().length > 0;
const validateFile = (value: string) => value.trim().length > 0 && value.endsWith('.ts');

export class Repl extends Prompt {
    async collectConfiguration(): Promise<BarrelReaperArgs> {
        Std.info('Configuration:');

        const barrelFile = await this.prompt({ prompt: 'Barrel file path', required: true, validate: validateFile });
        const barrelAlias = await this.prompt({ prompt: 'Import alias', required: false });
        const reaperGlob = await this.prompt({ prompt: 'Search glob', required: true, validate: validateGlob });
        const noFormat = (await this.prompt({ prompt: 'Skip formatting? (y/n)', transform: parseBoolean })) ?? false;
        const dryRun = (await this.prompt({ prompt: 'Dry run? (y/n)', transform: parseBoolean })) ?? false;

        return {
            barrelFile,
            reaperGlob,
            barrelAlias,
            noFormat,
            dryRun,
        };
    }
}
