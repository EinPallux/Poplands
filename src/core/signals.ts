/**
 * Tiny reactive primitives for the DOM UI layer (TECH §10, S2).
 * ~80 lines: signal (writable), computed (derived), effect (side-effectful subscriber).
 * No virtual DOM — effects update text nodes / styles surgically.
 */

type Subscriber = () => void;

let currentEffect: Subscriber | null = null;
let currentDeps: Set<Set<Subscriber>> | null = null;

export interface ReadonlySignal<T> {
  get(): T;
}

export interface Signal<T> extends ReadonlySignal<T> {
  set(value: T): void;
  update(fn: (prev: T) => T): void;
}

export function signal<T>(initial: T): Signal<T> {
  let value = initial;
  const subs = new Set<Subscriber>();
  return {
    get() {
      if (currentEffect && currentDeps) {
        subs.add(currentEffect);
        currentDeps.add(subs);
      }
      return value;
    },
    set(next: T) {
      if (Object.is(next, value)) return;
      value = next;
      // copy: effects may resubscribe while we iterate
      for (const s of [...subs]) s();
    },
    update(fn) {
      this.set(fn(value));
    },
  };
}

/**
 * Runs `fn` now and re-runs it whenever any signal it read changes.
 * Returns a disposer that unsubscribes everywhere.
 */
export function effect(fn: () => void): () => void {
  let deps = new Set<Set<Subscriber>>();
  const run = () => {
    for (const set of deps) set.delete(run);
    deps = new Set();
    const prevEffect = currentEffect;
    const prevDeps = currentDeps;
    currentEffect = run;
    currentDeps = deps;
    try {
      fn();
    } finally {
      currentEffect = prevEffect;
      currentDeps = prevDeps;
    }
  };
  run();
  return () => {
    for (const set of deps) set.delete(run);
    deps.clear();
  };
}

/** Derived read-only signal; recomputes lazily via an internal effect. */
export function computed<T>(fn: () => T): ReadonlySignal<T> {
  const out = signal<T>(undefined as T);
  effect(() => out.set(fn()));
  return { get: () => out.get() };
}
