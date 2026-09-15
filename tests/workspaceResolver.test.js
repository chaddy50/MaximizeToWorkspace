import {
    findFirstEmptyWorkspaceIndex,
    resolveTargetWorkspace,
} from '../maximize-to-workspace@nchaddy.github.io/lib/workspaceResolver.js';

import {
    test, assertTrue, assertEqual, reportAndExit,
    fakeWindow, fakeWorkspace, fakeWorkspaceManager,
} from './harness.js';

test('findFirstEmptyWorkspaceIndex finds the first empty workspace above home', () => {
    const manager = fakeWorkspaceManager([
        fakeWorkspace([fakeWindow()], 0),
        fakeWorkspace([], 1),
        fakeWorkspace([], 2),
    ]);

    assertEqual(findFirstEmptyWorkspaceIndex(manager, 0, 0), 1, 'first empty index');
});

test('findFirstEmptyWorkspaceIndex never returns the home index, even when home is empty', () => {
    const manager = fakeWorkspaceManager([
        fakeWorkspace([], 0),
        fakeWorkspace([], 1),
    ]);

    // The reserved-home invariant: workspace 0 is not a fullscreen target.
    assertEqual(findFirstEmptyWorkspaceIndex(manager, 0, 0), 1, 'skips the empty home workspace');
});

test('findFirstEmptyWorkspaceIndex returns -1 when every workspace above home is occupied', () => {
    const manager = fakeWorkspaceManager([
        fakeWorkspace([fakeWindow()], 0),
        fakeWorkspace([fakeWindow()], 1),
    ]);

    assertEqual(findFirstEmptyWorkspaceIndex(manager, 0, 0), -1, 'no empty workspace');
});

test('findFirstEmptyWorkspaceIndex honors a non-zero home workspace index', () => {
    const manager = fakeWorkspaceManager([
        fakeWorkspace([], 0),
        fakeWorkspace([], 1),
        fakeWorkspace([fakeWindow()], 2),
        fakeWorkspace([], 3),
    ]);

    assertEqual(findFirstEmptyWorkspaceIndex(manager, 2, 0), 3, 'first empty above home index 2');
});

test('resolveTargetWorkspace returns an existing empty workspace without appending', () => {
    const emptyWorkspace = fakeWorkspace([], 1);
    const manager = fakeWorkspaceManager([fakeWorkspace([fakeWindow()], 0), emptyWorkspace]);

    const resolved = resolveTargetWorkspace(manager, 0, 0, 12345);

    assertTrue(resolved === emptyWorkspace, 'returned the existing empty workspace');
    assertEqual(manager.appendCalls.length, 0, 'append call count');
});

test('resolveTargetWorkspace appends a workspace when none above home is free', () => {
    const manager = fakeWorkspaceManager([
        fakeWorkspace([fakeWindow()], 0),
        fakeWorkspace([fakeWindow()], 1),
    ]);

    const resolved = resolveTargetWorkspace(manager, 0, 0, 12345);

    assertEqual(manager.appendCalls.length, 1, 'append call count');
    assertTrue(resolved === manager.get_workspace_by_index(2), 'returned the appended workspace');
});

test('resolveTargetWorkspace appends without activating, so no empty workspace flashes up', () => {
    const manager = fakeWorkspaceManager([fakeWorkspace([fakeWindow()], 0)]);

    resolveTargetWorkspace(manager, 0, 0, 12345);

    assertEqual(manager.appendCalls[0].activate, false, 'append activate argument');
    assertEqual(manager.appendCalls[0].timestamp, 12345, 'append timestamp argument');
});

reportAndExit();
