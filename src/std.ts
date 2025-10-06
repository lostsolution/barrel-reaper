export const ellipsePath = (path: string, maxWidth: number): string => {
    const displayWidth = path.length;
    if (displayWidth <= maxWidth) return path;

    const segments = path.split('/');
    const filename = segments[segments.length - 1];

    /** Preserve filename */
    if (segments.length <= 2) return `…/${filename}`;

    /** Keep last 3 segments */
    const lastSegments = segments.slice(-3);
    const candidate = `…/${lastSegments.join('/')}`;

    return displayWidth <= maxWidth ? candidate : `…/${filename}`;
};

export class Std {
    static write(message: string): void {
        process.stdout.write(message);
    }

    static writeLine(message: string): void {
        process.stdout.write(message + '\n');
    }

    static info(message: string, detail: string = ''): void {
        Std.writeLine(`\x1b[36m→ ${message}\x1b[0m ${detail}`);
    }

    static success(message: string, detail: string = ''): void {
        Std.writeLine(`\x1b[32m✓ ${message}\x1b[0m ${detail}`);
    }

    static warning(message: string, detail: string = ''): void {
        Std.writeLine(`\x1b[33m⚔ ${message}\x1b[0m ${detail}`);
    }

    static error(message: string, detail: string = ''): void {
        Std.writeLine(`\x1b[31m☠ ${message}\x1b[0m ${detail}`);
    }
}
