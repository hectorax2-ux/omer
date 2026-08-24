type Listener = { scope: string; run: () => void };

const listeners = new Set<Listener>();

export function emitScrollToTop(scope: string) {
  listeners.forEach((listener) => {
    if (listener.scope === scope) listener.run();
  });
}

export function subscribeScrollToTop(scope: string, run: () => void) {
  const listener = { scope, run };
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
