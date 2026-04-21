// Shared timer-tracking utilities for editor-coverage tests.
//
// The editor tests need to catch stray setInterval/setTimeout callbacks
// (e.g. InputEcho's 50ms heartbeat) so they can be cancelled after each
// test and don't fire against stale module state in later tests. The
// tracking is shared across editor-coverage-a and -b because bun loads
// all test modules up-front; if each file wrapped at module top, the
// second wrap would capture the first wrap as its "original", which
// turns into a chain of wrappers that breaks unrelated tests' timers.

type Timer = ReturnType<typeof setTimeout>;
type Interval = ReturnType<typeof setInterval>;

const activeIntervals = new Set<Interval>();
const activeTimeouts = new Set<Timer>();

const origSetInterval = globalThis.setInterval;
const origClearInterval = globalThis.clearInterval;
const origSetTimeout = globalThis.setTimeout;
const origClearTimeout = globalThis.clearTimeout;

function wrappedSetInterval(this: any, ...args: any[]) {
    // @ts-expect-error variadic forwarding
    const id = origSetInterval.apply(this, args);
    activeIntervals.add(id);
    return id;
}

function wrappedClearInterval(id: any) {
    activeIntervals.delete(id);
    return origClearInterval(id);
}

function wrappedSetTimeout(this: any, ...args: any[]) {
    // @ts-expect-error variadic forwarding
    const id = origSetTimeout.apply(this, args);
    activeTimeouts.add(id);
    return id;
}

function wrappedClearTimeout(id: any) {
    activeTimeouts.delete(id);
    return origClearTimeout(id);
}

let installed = false;

export function ensureTrackedTimers() {
    if (installed) return;
    installed = true;
    (globalThis as any).setInterval = wrappedSetInterval;
    (globalThis as any).clearInterval = wrappedClearInterval;
    (globalThis as any).setTimeout = wrappedSetTimeout;
    (globalThis as any).clearTimeout = wrappedClearTimeout;
}

export function installWindowTimerTracking() {
    // Re-wire window.setTimeout/setInterval so SocialCalc's window.setTimeout
    // calls are tracked too. Called after each installBrowserShim().
    const win = (globalThis as any).window;
    if (win) {
        win.setTimeout = wrappedSetTimeout;
        win.clearTimeout = wrappedClearTimeout;
        win.setInterval = wrappedSetInterval;
        win.clearInterval = wrappedClearInterval;
    }
}

export function cancelActiveTrackedTimers() {
    for (const id of activeIntervals) origClearInterval(id);
    activeIntervals.clear();
    for (const id of activeTimeouts) origClearTimeout(id);
    activeTimeouts.clear();
}

export function restoreOriginalTimers() {
    (globalThis as any).setInterval = origSetInterval;
    (globalThis as any).clearInterval = origClearInterval;
    (globalThis as any).setTimeout = origSetTimeout;
    (globalThis as any).clearTimeout = origClearTimeout;
    const win = (globalThis as any).window;
    if (win) {
        win.setTimeout = origSetTimeout;
        win.clearTimeout = origClearTimeout;
        win.setInterval = origSetInterval;
        win.clearInterval = origClearInterval;
    }
    installed = false;
}
