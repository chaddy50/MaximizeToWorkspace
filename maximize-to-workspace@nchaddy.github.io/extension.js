import Meta from 'gi://Meta';
import Gio from 'gi://Gio';
import {Extension, InjectionManager} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import {
    isManageableWindow,
    isWindowFullyMaximized,
    isWindowOnManagedMonitor,
} from './lib/windowFilter.js';
import {resolveTargetWorkspace} from './lib/workspaceResolver.js';
import {WindowStateTracker} from './lib/windowStateTracker.js';

const MOVE_INTENT = 'move';
const RETURN_INTENT = 'return';

export default class MaximizeToWorkspaceExtension extends Extension {
    enable() {
        this._settings = this.getSettings();
        this._mutterSettings = new Gio.Settings({schema_id: 'org.gnome.mutter'});
        this._tracker = new WindowStateTracker();

        // GNOME Shell's own dynamic-workspace tracker deletes an empty, inactive,
        // non-trailing workspace on its next check — including the home workspace the
        // moment its last window leaves. Pin it alive for the extension's lifetime so
        // that reap can never fire and reindex a fullscreen workspace down to index 0.
        this._injectionManager = new InjectionManager();
        this._injectionManager.overrideMethod(
            Main.wm._workspaceTracker, '_checkWorkspaces',
            originalMethod => this._wrapCheckWorkspaces(originalMethod));

        // Window id -> MOVE_INTENT | RETURN_INTENT, written when a size change starts and
        // consumed when it completes.
        this._pendingSizeChanges = new Map();

        // Windows restored at login arrive maximized; moving them would reshuffle the
        // session the user just logged into.
        this._isStartupComplete = false;
        this._tracker.deferOnce(this._settings.get_int('startup-delay-ms'), () => {
            this._isStartupComplete = true;
        });

        global.window_manager.connectObject(
            'size-change', (_windowManager, actor, change) => this._onSizeChange(actor, change),
            'size-changed', (_windowManager, actor) => this._onSizeChanged(actor),
            'minimize', (_windowManager, actor) => this._onMinimize(actor),
            'destroy', (_windowManager, actor) => this._onDestroy(actor),
            this);
    }

    disable() {
        global.window_manager.disconnectObject(this);

        this._injectionManager.clear();
        this._injectionManager = null;

        // Managed windows are deliberately left where they are: yanking the user's windows
        // around during a shell restart or a screen lock is worse than leaving them be.
        this._tracker.destroy();
        this._tracker = null;
        this._pendingSizeChanges.clear();
        this._pendingSizeChanges = null;
        this._mutterSettings = null;
        this._settings = null;
        this._isStartupComplete = false;
    }

    _intentForSizeChange(change) {
        if (change === Meta.SizeChange.MAXIMIZE || change === Meta.SizeChange.FULLSCREEN)
            return MOVE_INTENT;

        if (change === Meta.SizeChange.UNMAXIMIZE || change === Meta.SizeChange.UNFULLSCREEN)
            return RETURN_INTENT;

        // MONITOR_MOVE reaches here too, and is not a maximize state change.
        return null;
    }

    /**
     * size-change fires as the transition starts, so nothing is done here beyond recording
     * what the transition means — acting now would race the animation.
     */
    _onSizeChange(actor, change) {
        const window = actor.meta_window;
        if (!window)
            return;

        const intent = this._intentForSizeChange(change);
        if (!intent)
            return;

        this._pendingSizeChanges.set(window.get_id(), intent);
    }

    _onSizeChanged(actor) {
        const window = actor.meta_window;
        if (!window)
            return;

        const windowId = window.get_id();
        const intent = this._pendingSizeChanges.get(windowId);
        if (!intent)
            return;

        // Drop the intent before acting so a failure cannot strand a stale entry.
        this._pendingSizeChanges.delete(windowId);

        if (intent === MOVE_INTENT) {
            this._moveWindowToOwnWorkspace(window);
            return;
        }

        if (!this._settings.get_boolean('return-on-unmaximize'))
            return;

        this._returnWindowHome(window, true);
    }

    _onMinimize(actor) {
        if (!this._settings.get_boolean('return-on-minimize'))
            return;

        const window = actor.meta_window;
        if (!window)
            return;

        this._returnWindowHome(window, true);
    }

    _onDestroy(actor) {
        const window = actor.meta_window;
        if (!window)
            return;

        // Runs for unmanaged windows too, so that ids never accumulate: mutter reuses them.
        const wasManaged = this._tracker.isManaged(window);
        this._tracker.clearManaged(window);
        this._pendingSizeChanges.delete(window.get_id());

        if (!wasManaged)
            return;

        // Only the view moves — the window itself is already going away, and touching a
        // half-destroyed MetaWindow risks taking the shell with it.
        const homeWorkspace = global.display.get_workspace_manager()
            .get_workspace_by_index(this._settings.get_int('home-workspace-index'));
        homeWorkspace?.activate(global.get_current_time());
    }

    /**
     * Wraps WorkspaceTracker._checkWorkspaces so the home workspace is marked "kept
     * alive" for the duration of each check, exempting it from the sweep that deletes
     * empty, inactive, non-trailing workspaces. Same technique the built-in Auto Move
     * Windows extension uses to pin a workspace in place. `this` inside the returned
     * function is the WorkspaceTracker instance, not the extension.
     */
    _wrapCheckWorkspaces(originalMethod) {
        const settings = this._settings;

        /* eslint-disable no-invalid-this */
        return function (...args) {
            const homeWorkspace = this._workspaces[settings.get_int('home-workspace-index')];
            const wasAlreadyKeptAlive = Boolean(homeWorkspace?._keepAliveId);

            if (homeWorkspace && !wasAlreadyKeptAlive)
                homeWorkspace._keepAliveId = 1;

            try {
                return originalMethod.apply(this, args);
            } finally {
                if (homeWorkspace && !wasAlreadyKeptAlive)
                    delete homeWorkspace._keepAliveId;
            }
        };
        /* eslint-enable no-invalid-this */
    }

    _moveWindowToOwnWorkspace(window) {
        if (!this._isStartupComplete)
            return;
        if (Main.overview.visible)
            return;
        if (!isManageableWindow(window))
            return;
        if (!isWindowOnManagedMonitor(window, this._mutterSettings))
            return;
        if (!isWindowFullyMaximized(window) && !window.is_fullscreen())
            return;
        if (this._tracker.isManaged(window))
            return;

        const homeWorkspaceIndex = this._settings.get_int('home-workspace-index');
        const monitorIndex = this._mutterSettings.get_boolean('workspaces-only-on-primary')
            ? window.get_monitor()
            : null;

        this._tracker.runGuarded(window, () => {
            // Fullscreen before switching workspace so the resize settles first: the
            // workspace-switch animation then carries an already-fullscreen window
            // instead of a still-resizing one, avoiding two overlapping animations.
            if (this._settings.get_boolean('force-fullscreen') && !window.is_fullscreen())
                window.make_fullscreen();

            const workspaceManager = window.get_display().get_workspace_manager();

            // A window maximized while already on its own workspace is fullscreened in
            // place; without this it would walk further up the workspace list each time.
            const isAlreadyOffHomeWorkspace =
                window.get_workspace().index() !== homeWorkspaceIndex;

            if (!isAlreadyOffHomeWorkspace) {
                const targetWorkspace = resolveTargetWorkspace(
                    workspaceManager, homeWorkspaceIndex, monitorIndex, global.get_current_time());

                window.change_workspace(targetWorkspace);
                targetWorkspace.activate_with_focus(window, global.get_current_time());
            }

            this._tracker.markManaged(window);
        });
    }

    _returnWindowHome(window, shouldFollowView) {
        if (!this._tracker.isManaged(window))
            return;

        this._tracker.runGuarded(window, () => {
            // Clear the mark before un-fullscreening: unmake_fullscreen() queues an
            // UNFULLSCREEN size change, which is itself a return trigger.
            this._tracker.clearManaged(window);

            if (window.is_fullscreen())
                window.unmake_fullscreen();

            const workspaceManager = window.get_display().get_workspace_manager();
            const homeWorkspace = workspaceManager.get_workspace_by_index(
                this._settings.get_int('home-workspace-index'));

            // The configured index can exceed the workspace count if num-workspaces was
            // lowered after it was set.
            if (!homeWorkspace)
                return;

            window.change_workspace(homeWorkspace);

            // activate(), not activate_with_focus(): on the minimize path refocusing the
            // window would immediately un-minimize it.
            if (shouldFollowView)
                homeWorkspace.activate(global.get_current_time());
        });
    }
}
