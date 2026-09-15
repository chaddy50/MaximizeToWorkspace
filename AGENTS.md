# AGENTS.md

Maximize To Workspace: a GNOME Shell extension that moves a maximized window onto its own workspace and forces it fullscreen, macOS-style. The first workspace stays reserved for ordinary windows; minimizing, un-maximizing, or closing returns the window there.

## Stack

- GJS (ESM JavaScript) against the GNOME Shell extension API, shell versions 48–50
- Developed against GNOME Shell 50.2 / mutter 50.1 / GJS 1.88 on Wayland (Fedora 44)
- GSettings for preferences (`schemas/*.gschema.xml`), libadwaita for the prefs dialog
- Tests are a zero-dependency TAP harness run by `gjs -m` — `jasmine-gjs` is not packaged for Fedora, so the suites use plain fakes and a hand-rolled runner

## Layout

- `maximize-to-workspace@nchaddy.github.io/` — the extension itself; the directory name **must** equal the `uuid` in `metadata.json` or the shell silently refuses to load it.
  - `extension.js` — lifecycle, `global.window_manager` signal wiring, the maximize and return paths. Kept thin: only the parts that genuinely need shell globals.
  - `lib/` — the decision logic, as pure functions taking explicit parameters so it is unit-testable outside a running shell.
  - `prefs.js` — Adwaita preferences dialog. Runs in a plain GTK process.
  - `schemas/` — GSettings schema. `gschemas.compiled` is generated, never committed.
- `tests/` — one test file per production file (`lib/windowFilter.js` → `tests/windowFilter.test.js`), plus `harness.js` (assertions and fakes) and `run.js` (the runner).
- `install.sh` — compiles schemas, installs into `~/.local/share/gnome-shell/extensions/`, enables the extension.

## Commands

- `GI_TYPELIB_PATH=/usr/lib64/mutter-18 gjs -m tests/run.js` — run the test suite. The typelib path is required because `Meta` lives outside the default search path; without it the `gi://Meta` imports fail.
- `glib-compile-schemas --strict --dry-run "maximize-to-workspace@nchaddy.github.io/schemas/"` — validate the settings schema.
- `./install.sh` — install and enable locally.
- `dbus-run-session -- gnome-shell --nested --wayland` — manual verification without disturbing the running session. On Wayland a logout/login is otherwise required to load new extension code (`Alt+F2` → `r` is X11-only).
- `journalctl -f -o cat /usr/bin/gnome-shell` — watch shell logs while testing.

Before declaring work complete, run the test suite and the schema check.

## Conventions

- **Keep decision logic out of `extension.js`.** Anything that can be expressed as a function over explicit parameters belongs in `lib/`, where it can be tested. `extension.js` should read as signal wiring plus guard clauses.
- **Never reference `global` from `lib/`.** It only exists inside the shell process and makes the module untestable — pass what's needed (timestamps, settings values) in as parameters.
- **Every window mutation goes through `WindowStateTracker.runGuarded()`.** The extension reacts to the same signals its own `make_fullscreen()` / `change_workspace()` calls emit; the guard is the single choke point that prevents re-entrancy.
- **Every `GLib` timeout goes through `WindowStateTracker.deferOnce()`.** A source that outlives `disable()` fires into a torn-down extension and crashes the shell.
- Use `window.is_maximized()`, never `get_maximized()` — the latter was removed in GNOME 49.
- `prefs.js` must not import `Meta`, `Clutter`, `St`, or anything under `resource:///org/gnome/shell/ui/`; it runs outside the shell.
- Tests colocate one file per production file under `tests/`, named after the file they cover.
- **Import test targets by relative path, never absolute.** This repo's path contains spaces, and GJS fails to resolve an absolute ESM specifier containing them (`Module not found: .../GNOME%20Extensions/...`). Relative specifiers resolve correctly, so run the suites from the repo root.

## Git & Commits

- **Never include Claude (or any AI assistant) as a commit co-author or contributor.** No `Co-Authored-By: Claude` trailer, no "Generated with Claude Code" line, no assistant mention in commit messages, PR titles, or PR descriptions. Write commits as the author, describing the change and why.
- Create commits only when explicitly asked.
