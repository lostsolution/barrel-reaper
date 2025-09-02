import { readFile, writeFile } from 'node:fs/promises';
import prettier from 'prettier';

export class Formatter {
    async formatFile(filepath: string): Promise<boolean> {
        let formatted = true;

        const originalContent = await readFile(filepath, 'utf8');
        const prettierConfig = (await prettier.resolveConfig(filepath)) ?? {};

        let formattedContent = originalContent;

        formattedContent = await prettier.format(formattedContent, { ...prettierConfig, filepath }).catch(() => {
            formatted = false;
            return formattedContent;
        });

        await writeFile(filepath, formattedContent);
        return formatted;
    }
}
