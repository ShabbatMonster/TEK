import type { TekEventKey, TekEvents } from "./types";

type Handler<K extends TekEventKey> = (payload: TekEvents[K]) => void;

const handlers = new Map<TekEventKey, Set<Handler<TekEventKey>>>();

export const bus = {
  on<K extends TekEventKey>(key: K, fn: Handler<K>): () => void {
    if (!handlers.has(key)) handlers.set(key, new Set());
    handlers.get(key)!.add(fn as Handler<TekEventKey>);
    return () => handlers.get(key)?.delete(fn as Handler<TekEventKey>);
  },
  emit<K extends TekEventKey>(key: K, payload: TekEvents[K]): void {
    handlers.get(key)?.forEach((fn) => {
      try {
        fn(payload);
      } catch (e) {
        console.error(`[tek:bus] handler error for ${key}`, e);
      }
    });
  },
};
