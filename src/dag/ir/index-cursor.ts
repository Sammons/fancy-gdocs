export class IndexCursor {
  #idx: number;

  constructor(origin: number) {
    this.#idx = origin;
  }

  getIndex(): number {
    return this.#idx;
  }

  advance(n: number): void {
    if (n < 0) throw new Error(`IndexCursor.advance rejects negative delta: ${n}`);
    this.#idx += n;
  }

  reset(origin: number): void {
    this.#idx = origin;
  }

  withFixedIndex<T>(pinned: number, body: () => T): T {
    const saved = this.#idx;
    this.#idx = pinned;
    try {
      return body();
    } finally {
      this.#idx = saved;
    }
  }
}
