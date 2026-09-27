import Meta from 'gi://Meta';

import {
    isManageableWindow,
    isWindowFullyMaximized,
    isWindowOnManagedMonitor,
    countManageableWindowsOnWorkspace,
    shouldMoveNewWindowHome,
} from '../maximize-to-workspace@nchaddy.github.io/lib/windowFilter.js';

import {
    test, assertTrue, assertFalse, assertEqual, reportAndExit,
    fakeWindow, fakeWorkspace, fakeSettings,
} from './harness.js';

test('isManageableWindow accepts a plain normal window', () => {
    assertTrue(isManageableWindow(fakeWindow()), 'plain normal window');
});

test('isManageableWindow rejects a dialog', () => {
    const dialog = fakeWindow({window_type: Meta.WindowType.DIALOG});
    assertFalse(isManageableWindow(dialog), 'dialog');
});

test('isManageableWindow rejects a window pinned to all workspaces', () => {
    const pinned = fakeWindow({is_always_on_all_workspaces: () => true});
    assertFalse(isManageableWindow(pinned), 'pinned window');
});

test('isManageableWindow rejects a window that skips the taskbar', () => {
    assertFalse(isManageableWindow(fakeWindow({skip_taskbar: true})), 'skip_taskbar window');
});

test('isManageableWindow rejects a transient child window', () => {
    const transient = fakeWindow({get_transient_for: () => fakeWindow()});
    assertFalse(isManageableWindow(transient), 'transient window');
});

test('isManageableWindow rejects a window not showing on its workspace', () => {
    const hidden = fakeWindow({showing_on_its_workspace: () => false});
    assertFalse(isManageableWindow(hidden), 'hidden window');
});

test('isManageableWindow accepts a NORMAL window even though that enum value is 0', () => {
    // Guards against a truthiness check like `if (!window.window_type)`.
    assertEqual(Meta.WindowType.NORMAL, 0, 'Meta.WindowType.NORMAL');
    assertTrue(isManageableWindow(fakeWindow()), 'normal window with enum value 0');
});

test('isWindowFullyMaximized is true for a maximized window', () => {
    assertTrue(isWindowFullyMaximized(fakeWindow({is_maximized: () => true})), 'maximized');
});

test('isWindowFullyMaximized is false for a restored window', () => {
    assertFalse(isWindowFullyMaximized(fakeWindow({is_maximized: () => false})), 'restored');
});

test('isWindowFullyMaximized never touches the removed get_maximized()', () => {
    const window = fakeWindow({is_maximized: () => true});
    Object.defineProperty(window, 'get_maximized', {
        get() {
            throw new Error('get_maximized() was removed in GNOME 49 and must not be used');
        },
    });

    assertTrue(isWindowFullyMaximized(window), 'maximized without using get_maximized()');
});

test('isWindowOnManagedMonitor accepts the primary monitor when only-on-primary is set', () => {
    const settings = fakeSettings({'workspaces-only-on-primary': true});
    const window = fakeWindow({
        get_monitor: () => 0,
        get_display: () => ({get_primary_monitor: () => 0}),
    });

    assertTrue(isWindowOnManagedMonitor(window, settings), 'window on primary');
});

test('isWindowOnManagedMonitor rejects a secondary monitor when only-on-primary is set', () => {
    const settings = fakeSettings({'workspaces-only-on-primary': true});
    const window = fakeWindow({
        get_monitor: () => 1,
        get_display: () => ({get_primary_monitor: () => 0}),
    });

    assertFalse(isWindowOnManagedMonitor(window, settings), 'window on secondary');
});

test('isWindowOnManagedMonitor accepts a secondary monitor when only-on-primary is unset', () => {
    const settings = fakeSettings({'workspaces-only-on-primary': false});
    const window = fakeWindow({
        get_monitor: () => 1,
        get_display: () => ({get_primary_monitor: () => 0}),
    });

    assertTrue(isWindowOnManagedMonitor(window, settings), 'window on secondary');
});

test('countManageableWindowsOnWorkspace counts only manageable windows', () => {
    const workspace = fakeWorkspace([
        fakeWindow(),
        fakeWindow({window_type: Meta.WindowType.DIALOG}),
        fakeWindow({is_always_on_all_workspaces: () => true}),
    ]);

    assertEqual(countManageableWindowsOnWorkspace(workspace, 0), 1, 'manageable window count');
});

test('countManageableWindowsOnWorkspace with a null monitor counts every monitor', () => {
    const workspace = fakeWorkspace([
        fakeWindow({get_monitor: () => 0}),
        fakeWindow({get_monitor: () => 1}),
    ]);

    assertEqual(countManageableWindowsOnWorkspace(workspace, null), 2, 'count across monitors');
    assertEqual(countManageableWindowsOnWorkspace(workspace, 0), 1, 'count on monitor 0');
});

test('countManageableWindowsOnWorkspace returns zero for an empty workspace', () => {
    assertEqual(countManageableWindowsOnWorkspace(fakeWorkspace([]), 0), 0, 'empty workspace');
});

test('shouldMoveNewWindowHome accepts a manageable window away from the home workspace', () => {
    const settings = fakeSettings({'workspaces-only-on-primary': false});
    const window = fakeWindow({get_workspace: () => fakeWorkspace([], 3)});

    assertTrue(shouldMoveNewWindowHome(window, settings, 0), 'window away from home');
});

test('shouldMoveNewWindowHome rejects a window isManageableWindow would reject', () => {
    const settings = fakeSettings({'workspaces-only-on-primary': false});
    const dialog = fakeWindow({
        window_type: Meta.WindowType.DIALOG,
        get_workspace: () => fakeWorkspace([], 3),
    });

    assertFalse(shouldMoveNewWindowHome(dialog, settings, 0), 'dialog away from home');
});

test('shouldMoveNewWindowHome rejects a window on a non-managed monitor', () => {
    const settings = fakeSettings({'workspaces-only-on-primary': true});
    const window = fakeWindow({
        get_monitor: () => 1,
        get_display: () => ({get_primary_monitor: () => 0}),
        get_workspace: () => fakeWorkspace([], 3),
    });

    assertFalse(shouldMoveNewWindowHome(window, settings, 0), 'window on secondary monitor');
});

test('shouldMoveNewWindowHome rejects a window already on the home workspace', () => {
    const settings = fakeSettings({'workspaces-only-on-primary': false});
    const window = fakeWindow({get_workspace: () => fakeWorkspace([], 0)});

    assertFalse(shouldMoveNewWindowHome(window, settings, 0), 'window already home');
});

reportAndExit();
