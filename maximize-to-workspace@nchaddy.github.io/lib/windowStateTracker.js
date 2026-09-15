import GLib from 'gi://GLib';

/**
 * Owns every piece of mutable state the extension keeps, so that disabling it has exactly
 * one thing to tear down.
 *
 * Windows are tracked by id rather than by object so that a destroyed MetaWindow is never
 * retained; the extension's destroy handler is what drops the id again.
 */
export class WindowStateTracker {
    constructor() {
        this._managedWindowIds = new Set();
        this._inFlightWindowIds = new Set();
        this._pendingTimeoutIds = new Set();
    }

    isManaged(window) {
        return this._managedWindowIds.has(window.get_id());
    }

    markManaged(window) {
        this._managedWindowIds.add(window.get_id());
    }

    clearManaged(window) {
        this._managedWindowIds.delete(window.get_id());
    }

    /**
     * Runs an action that mutates a window, refusing to re-enter for the same window.
     * Every mutation the extension performs goes through here — it is the one choke point
     * that keeps the extension from reacting to its own changes.
     *
     * Returns false when the window was already in flight and the action was skipped.
     */
    runGuarded(window, action) {
        const windowId = window.get_id();
        if (this._inFlightWindowIds.has(windowId))
            return false;

        this._inFlightWindowIds.add(windowId);
        try {
            action();
        } finally {
            // Release on the next main-loop turn rather than now: the size-change signals
            // that make_fullscreen() and change_workspace() queue are dispatched after this
            // returns, and an immediate release would let them re-enter.
            this.deferOnce(0, () => this._inFlightWindowIds.delete(windowId));
        }

        return true;
    }

    deferOnce(delayMilliseconds, callback) {
        const timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, delayMilliseconds, () => {
            this._pendingTimeoutIds.delete(timeoutId);
            callback();
            return GLib.SOURCE_REMOVE;
        });

        this._pendingTimeoutIds.add(timeoutId);
        return timeoutId;
    }

    hasPendingTimeouts() {
        return this._pendingTimeoutIds.size > 0;
    }

    /**
     * A timeout that outlives disable() fires into a torn-down extension and takes the
     * shell down with it, so every pending source is removed here.
     */
    destroy() {
        for (const timeoutId of this._pendingTimeoutIds)
            GLib.source_remove(timeoutId);

        this._pendingTimeoutIds.clear();
        this._managedWindowIds.clear();
        this._inFlightWindowIds.clear();
    }
}
