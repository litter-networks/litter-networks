export function scheduleStateUpdate(fn: () => void) {
  if (typeof queueMicrotask === 'function') {
    queueMicrotask(fn);
    return;
  }
  Promise.resolve().then(fn);
}
