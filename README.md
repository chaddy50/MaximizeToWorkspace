# Maximize To Workspace

A GNOME Shell extension that reproduces the macOS "maximize into its own Space" behavior.

Maximize a window and it moves onto a workspace of its own and goes fullscreen. Minimize it —
or un-maximize it, leave fullscreen, or close it — and it comes back to the home workspace,
with the view following it.

The **home workspace (the first one) is reserved**: it holds your ordinary, non-maximized
windows and never receives a fullscreen window. Only the second workspace onward is used as a
fullscreen target.

Built for GNOME Shell 48–50 (developed against 50.2 / mutter 50.1 / GJS 1.88 on Wayland).

## Install

```
./install.sh
```

This compiles the schemas, copies the extension into
`~/.local/share/gnome-shell/extensions/`, and enables it.

### Disable the conflicting extensions first

Two commonly installed extensions hook the same `global.window_manager` signals and will
fight this one for the same windows:

```
gnome-extensions disable MaximizeWindowIntoNewWorkspace@kyleross.com
gnome-extensions disable maximize-workspace-history@amancode22.github.com
```

### Loading new code on Wayland

On Wayland a logout/login is required for the shell to pick up new extension code — `Alt+F2`
→ `r` works on X11 only. To iterate without disturbing your session, use a nested shell:

```
dbus-run-session -- gnome-shell --nested --wayland
```

## Settings

`gnome-extensions prefs maximize-to-workspace@nchaddy.github.io`

| Setting | Default | Meaning |
|---|---|---|
| Force fullscreen | on | Hide the top bar once the window is on its own workspace. Off leaves it merely maximized. |
| Return home on minimize | on | Minimizing moves the window back to the home workspace. |
| Return home on un-maximize | on | Un-maximizing or leaving fullscreen moves the window back. |
| Home workspace | 0 | The reserved workspace, **counted from zero**. Never receives a fullscreen window. |
| Startup delay | 3000 ms | Grace period after login before any window is moved, so a restored session is not reshuffled. |

## Behavior notes

- **Windows it ignores.** Dialogs and other non-normal windows, windows pinned to all
  workspaces, windows with `skip_taskbar`, transient child windows, and windows that are not
  showing on their workspace.
- **Multi-monitor.** When mutter's `workspaces-only-on-primary` is on (the default), windows on
  non-primary monitors are left alone, because only the primary monitor has per-monitor
  workspaces.
- **The sole-window case.** With dynamic workspaces enabled (the GNOME default), maximizing the
  *only* window on the home workspace fullscreens it in place rather than moving it. Moving it
  would leave the home workspace empty, and mutter reaps an emptied workspace — which shifts
  every index down and would make a fullscreen workspace become the first one. The visible
  result is the same either way.
- **Disabling the extension leaves your windows alone.** Managed windows are not repatriated or
  un-fullscreened on disable — yanking windows around during a shell restart or screen lock is
  worse than leaving them where they are.

## Development

Run the test suite:

```
GI_TYPELIB_PATH=/usr/lib64/mutter-18 gjs -m tests/run.js
```

Validate the settings schema on its own:

```
glib-compile-schemas --strict --dry-run "maximize-to-workspace@nchaddy.github.io/schemas/"
```

### Manual verification checklist

Run these inside a nested shell, watching the log with
`journalctl -f -o cat /usr/bin/gnome-shell`:

1. Open two terminal windows on workspace 1. Maximize one → it moves to workspace 2, goes
   fullscreen, and the view follows. The other window stays on workspace 1.
2. Minimize the fullscreen window → it returns to workspace 1, leaves fullscreen, stays
   minimized, and the view follows.
3. Un-maximize instead of minimizing → same return, but the window is focused.
4. Close the fullscreen window → the view switches back to workspace 1, no empty workspace
   lingers.
5. Maximize two windows in turn → they land on workspaces 2 and 3, one each, never on
   workspace 1.
6. With only one window open, maximize it → it goes fullscreen in place and workspace 1 is not
   destroyed.
7. Open a modal dialog from a fullscreen app → the dialog is left alone.
8. `gnome-extensions disable` then `enable` → no errors and no leaked-timeout warnings in the
   log.

## Architecture

| File | Responsibility |
|---|---|
| `extension.js` | Lifecycle, `window_manager` signal wiring, the maximize and return paths. |
| `lib/windowFilter.js` | Pure predicates deciding which windows are managed. |
| `lib/workspaceResolver.js` | Finds or creates the target workspace; guards the reserved home workspace. |
| `lib/windowStateTracker.js` | Managed-window bookkeeping, the re-entrancy guard, and timeout ownership. |
| `prefs.js` | Adwaita preferences dialog. |

The decision logic lives in `lib/` and takes explicit parameters, so it is unit-testable
outside a running shell. `extension.js` stays thin, holding only the parts that genuinely need
shell globals.
