/**
 * Typed event bus — the seam between simulation and presentation (TECH §3, S2).
 * Event names & payloads are compile-time checked against the app's EventMap.
 */

export type Handler<P> = (payload: P) => void;

export class EventBus<M extends Record<string, unknown>> {
  private handlers = new Map<keyof M, Set<Handler<never>>>();

  on<K extends keyof M>(event: K, handler: Handler<M[K]>): () => void {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as Handler<never>);
    return () => this.off(event, handler);
  }

  once<K extends keyof M>(event: K, handler: Handler<M[K]>): () => void {
    const off = this.on(event, (p) => {
      off();
      handler(p);
    });
    return off;
  }

  off<K extends keyof M>(event: K, handler: Handler<M[K]>): void {
    this.handlers.get(event)?.delete(handler as Handler<never>);
  }

  emit<K extends keyof M>(event: K, payload: M[K]): void {
    const set = this.handlers.get(event);
    if (!set) return;
    for (const h of set) (h as Handler<M[K]>)(payload);
  }

  /** Dev aid: total live subscriptions (leak detector hooks onto this, S2). */
  get subscriptionCount(): number {
    let n = 0;
    for (const set of this.handlers.values()) n += set.size;
    return n;
  }
}

/**
 * The application event map grows as systems land. v0.1 only needs a handful;
 * commands (cmd:*) flow UI→sim, domain events flow sim→presentation.
 */
export interface AppEvents extends Record<string, unknown> {
  'app:ready': void;
  'app:pause': void;
  'app:resume': { elapsedMs: number };
  'assets:progress': { phase: string; progress: number };
  'assets:phaseLoaded': { phase: string };
  'input:cellHover': { wx: number; wz: number } | null;
  'input:cellClick': { wx: number; wz: number };
  'camera:moved': void;
}

export const bus = new EventBus<AppEvents>();
