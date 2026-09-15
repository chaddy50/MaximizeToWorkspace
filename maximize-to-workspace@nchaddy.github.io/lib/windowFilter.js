import Meta from 'gi://Meta';

/**
 * Whether the extension should manage this window at all.
 *
 * Everything here is a reason a window has no single workspace of its own to be moved
 * between, or is a chrome window the user never thinks of as "an app".
 */
export function isManageableWindow(window) {
    if (window.window_type !== Meta.WindowType.NORMAL)
        return false;
    if (window.is_always_on_all_workspaces())
        return false;
    if (window.skip_taskbar)
        return false;
    if (window.get_transient_for() !== null)
        return false;
    if (!window.showing_on_its_workspace())
        return false;

    return true;
}

/**
 * GNOME 49 removed MetaWindow.get_maximized(); is_maximized() is the replacement and is
 * also present on 48, which is the oldest shell this extension claims.
 */
export function isWindowFullyMaximized(window) {
    return window.is_maximized();
}

/**
 * With workspaces-only-on-primary, only the primary monitor has per-monitor workspaces,
 * so moving a window on any other monitor would be meaningless.
 */
export function isWindowOnManagedMonitor(window, mutterSettings) {
    if (!mutterSettings.get_boolean('workspaces-only-on-primary'))
        return true;

    return window.get_monitor() === window.get_display().get_primary_monitor();
}

/**
 * The single definition of "is this workspace occupied", shared by the target-workspace
 * search and the guard that keeps the home workspace alive, so the two cannot disagree.
 * A null monitorIndex counts across every monitor.
 */
export function countManageableWindowsOnWorkspace(workspace, monitorIndex) {
    const isOnRequestedMonitor = window =>
        monitorIndex === null || window.get_monitor() === monitorIndex;

    return workspace.list_windows()
        .filter(window => isManageableWindow(window) && isOnRequestedMonitor(window))
        .length;
}
