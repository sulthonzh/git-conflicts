export class ProgressTracker {
  private total: number;
  private current: number;

  constructor(total: number) {
    this.total = total;
    this.current = 0;
  }

  increment(): void {
    this.current++;
  }

  getProgress(): { current: number; total: number; percent: number } {
    const percent = this.total === 0 ? 100 : Math.round((this.current / this.total) * 100);
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