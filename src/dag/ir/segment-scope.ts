export interface Scope {
  segmentId?: string;
  tabId?: string;
}

export class SegmentScope {
  #stack: Scope[] = [];

  getSegmentId(): string | undefined {
    return this.#top().segmentId;
  }

  getTabId(): string | undefined {
    return this.#top().tabId;
  }

  locationFields(): Record<string, string> {
    const { segmentId, tabId } = this.#top();
    const out: Record<string, string> = {};
    if (segmentId !== undefined) out.segmentId = segmentId;
    if (tabId !== undefined) out.tabId = tabId;
    return out;
  }

  push(scope: Scope): void {
    this.#stack.push({ ...scope });
  }

  pop(): void {
    if (this.#stack.length === 0) throw new Error("SegmentScope.pop on empty stack");
    this.#stack.pop();
  }

  withScope<T>(scope: Scope, body: () => T): T {
    this.push(scope);
    try {
      return body();
    } finally {
      this.pop();
    }
  }

  #top(): Scope {
    return this.#stack.length === 0 ? {} : this.#stack[this.#stack.length - 1];
  }
}
