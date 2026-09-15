import {countManageableWindowsOnWorkspace} from './windowFilter.js';

/**
 * The first workspace above the home workspace that holds no manageable window,
 * or -1 when every one of them is occupied.
 *
 * Starting the scan above the home workspace is what reserves it: it can never be
 * returned as a fullscreen target.
 */
export function findFirstEmptyWorkspaceIndex(workspaceManager, homeWorkspaceIndex, monitorIndex) {
    const workspaceCount = workspaceManager.get_n_workspaces();

    for (let index = homeWorkspaceIndex + 1; index < workspaceCount; index++) {
        const workspace = workspaceManager.get_workspace_by_index(index);
        if (!workspace)
            continue;

        if (countManageableWindowsOnWorkspace(workspace, monitorIndex) === 0)
            return index;
    }

    return -1;
}

/**
 * The workspace a newly maximized window should move to, creating one when every
 * workspace above the home workspace is already occupied.
 *
 * Returns the workspace object rather than an index because mutter can reap a workspace
 * at any time, which would leave a stored index pointing at a different one.
 */
export function resolveTargetWorkspace(workspaceManager, homeWorkspaceIndex, monitorIndex, currentTime) {
    const emptyWorkspaceIndex =
        findFirstEmptyWorkspaceIndex(workspaceManager, homeWorkspaceIndex, monitorIndex);

    if (emptyWorkspaceIndex !== -1)
        return workspaceManager.get_workspace_by_index(emptyWorkspaceIndex);

    // Append without activating: the caller activates only after the window has been moved
    // across, so the user never sees the new workspace flash up empty.
    return workspaceManager.append_new_workspace(false, currentTime);
}
