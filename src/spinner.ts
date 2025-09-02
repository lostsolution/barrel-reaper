import { Std } from './std';

export class ReaperSpinner {
    private frames = ['⚔', '☠', '⚰'];
    private interval: NodeJS.Timeout | null = null;
    private tick = 0;
    private currentMessage = '';

    private clearLine(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }

        Std.write('\r\x1b[2K');
        Std.write('\x1b[?25h');
    }

    start(message: string) {
        if (this.currentMessage || this.interval) this.stop();

        this.currentMessage = message;
        Std.write('\x1b[?25l');

        const animate = () => {
            const frame = this.frames[this.tick % this.frames.length];
            const dots = '.'.repeat((this.tick % 3) + 1);
            Std.write(`\r\x1b[31m${frame}\x1b[0m  ${this.currentMessage + dots}`);
            this.tick++;
        };

        animate();
        this.interval = setInterval(animate, 150);
    }

    pause(): void {
        this.clearLine();
    }

    resume(): void {
        if (!this.interval && this.currentMessage) this.start(this.currentMessage);
    }

    stop(message?: string): void {
        this.clearLine();
        if (message) Std.writeLine(message);
    }
}
