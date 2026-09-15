import GLib from 'gi://GLib';
import Meta from 'gi://Meta';
import System from 'system';

/**
 * Minimal TAP harness. jasmine-gjs is not packaged for Fedora, and the suites only need
 * assertions, a few fakes, and a way to turn the main loop, so this stays dependency-free.
 */

let caseNumber = 0;
let failedCount = 0;

export function test(name, fn) {
    caseNumber++;
    try {
        fn();
        print(`ok ${caseNumber} - ${name}`);
    } catch (error) {
        failedCount++;
        print(`not ok ${caseNumber} - ${name}`);
        print('  ---');
        print(`  ${error.message}`);
        print('  ...');
    }
}

export function assertEqual(actual, expected, description) {
    if (actual !== expected) {
        throw new Error(
            `${description}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    }
}

export function assertTrue(value, description) {
    assertEqual(value, true, description);
}

export function assertFalse(value, description) {
    assertEqual(value, false, description);
}

export function assertThrows(fn, description) {
    try {
        fn();
    } catch {
        return;
    }

    throw new Error(`${description}: expected a throw, but none happened`);
}

export function reportAndExit() {
    print(`1..${caseNumber}`);

    if (failedCount > 0) {
        print(`# failed ${failedCount} of ${caseNumber}`);
        System.exit(1);
    }

    print(`# all ${caseNumber} passed`);
}

// Paths are derived from this file's own location rather than the working directory, so
// the suites run correctly regardless of where they are invoked from.
const [harnessPath] = GLib.filename_from_uri(import.meta.url);
export const REPO_ROOT = GLib.path_get_dirname(GLib.path_get_dirname(harnessPath));
export const EXTENSION_UUID = 'maximize-to-workspace@nchaddy.github.io';
export const EXTENSION_DIR = GLib.build_filenamev([REPO_ROOT, EXTENSION_UUID]);

export function readTextFile(path) {
    const [wasRead, contents] = GLib.file_get_contents(path);
    if (!wasRead)
        throw new Error(`could not read ${path}`);

    return new TextDecoder().decode(contents);
}

export function runCommand(argv, workingDirectory = null) {
    const [, stdout, stderr, exitStatus] = GLib.spawn_sync(
        workingDirectory, argv, null, GLib.SpawnFlags.SEARCH_PATH, null);

    const decoder = new TextDecoder();
    return {
        exitStatus,
        stdout: decoder.decode(stdout ?? new Uint8Array()),
        stderr: decoder.decode(stderr ?? new Uint8Array()),
    };
}

/**
 * Turns the main loop for a moment so deferred sources get a chance to fire. The tracker
 * releases its re-entrancy guard on an idle, so several cases depend on this.
 */
export function runMainLoopBriefly(milliseconds = 20) {
    const loop = new GLib.MainLoop(null, false);

    GLib.timeout_add(GLib.PRIORITY_DEFAULT, milliseconds, () => {
        loop.quit();
        return GLib.SOURCE_REMOVE;
    });

    loop.run();
}

let nextWindowId = 1;

export function fakeWindow(overrides = {}) {
    const {id = nextWindowId++, ...rest} = overrides;

    return {
        window_type: Meta.WindowType.NORMAL,
        skip_taskbar: false,
        is_always_on_all_workspaces: () => false,
        get_transient_for: () => null,
        showing_on_its_workspace: () => true,
        is_maximized: () => false,
        is_fullscreen: () => false,
        get_monitor: () => 0,
        get_id: () => id,
        get_display: () => ({get_primary_monitor: () => 0}),
        ...rest,
    };
}

export function fakeWorkspace(windows = [], index = 0) {
    const workspace = {
        index: () => index,
        list_windows: () => windows,
        activateCallCount: 0,
        activateWithFocusCallCount: 0,
    };

    workspace.activate = () => {
        workspace.activateCallCount++;
    };
    workspace.activate_with_focus = () => {
        workspace.activateWithFocusCallCount++;
    };

    return workspace;
}

export function fakeWorkspaceManager(workspaces) {
    const manager = {
        appendCalls: [],
        get_n_workspaces: () => workspaces.length,
        get_workspace_by_index: index => workspaces[index] ?? null,
    };

    manager.append_new_workspace = (activate, timestamp) => {
        manager.appendCalls.push({activate, timestamp});
        const created = fakeWorkspace([], workspaces.length);
        workspaces.push(created);
        return created;
    };

    return manager;
}

export function fakeSettings(values) {
    return {
        get_boolean: key => values[key],
        get_int: key => values[key],
    };
}
