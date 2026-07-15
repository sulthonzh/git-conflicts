export class ProgressTracker {
  private total: number;
  private current: number;

  constructor(total: number) {
    if (typeof total !== 'number' || !Number.isFinite(total) || total < 0) {
      throw new Error(`Invalid total: expected a non-negative finite number, got ${total}`);
    }
    this.total = Math.floor(total);
    this.current = 0;
  }

  increment(): void {
    this.current++;
  }

  getProgress(): { current: number; total: number; percent: number } {
    const percent = this.total === 0 ? 100 : Math.min(100, Math.round((this.current / this.total) * 100));
    return {
      current: this.current,
      total: this.total,
      percent,
    };
  }

  isComplete(): boolean {
    return this.current >= this.total;
  }

  getRemaining(): number {
    return Math.max(0, this.total - this.current);
  }
}