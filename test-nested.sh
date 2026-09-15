#!/usr/bin/env bash
# Launch a nested GNOME Shell with ONLY this extension enabled, using an isolated dconf
# database so nothing here can affect the running desktop session.
#
# The extension files are copied into ~/.local/share/gnome-shell/extensions/ because the
# nested shell reads from there, but the extension is never added to the live session's
# enabled-extensions list — so the running shell will not load it.
set -euo pipefail

UUID="maximize-to-workspace@nchaddy.github.io"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$UUID"
TARGET_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

# The db name becomes part of a D-Bus object path, so it must stay alphanumeric.
NESTED_DB="m2wnested"
PROFILE_FILE="${XDG_RUNTIME_DIR:-/tmp}/maximize-to-workspace-dconf-profile"
RESOLUTION="${RESOLUTION:-1400x900}"

if [[ ! -d "$SOURCE_DIR" ]]; then
    echo "error: extension source not found at $SOURCE_DIR" >&2
    exit 1
fi

echo "==> Compiling schemas"
glib-compile-schemas "$SOURCE_DIR/schemas/"

echo "==> Installing to $TARGET_DIR"
rm -rf "$TARGET_DIR"
mkdir -p "$(dirname "$TARGET_DIR")"
cp -r "$SOURCE_DIR" "$TARGET_DIR"

printf 'user-db:%s\n' "$NESTED_DB" > "$PROFILE_FILE"

echo "==> Configuring the isolated session (dconf db: ~/.config/dconf/$NESTED_DB)"
dbus-run-session -- env DCONF_PROFILE="$PROFILE_FILE" bash -c "
    dconf write /org/gnome/shell/enabled-extensions \"['$UUID']\"
    dconf write /org/gnome/shell/disable-user-extensions false
    dconf write /org/gnome/mutter/dynamic-workspaces true
" >/dev/null 2>&1

cat <<NOTICE

==> Launching nested GNOME Shell (${RESOLUTION})

    Only $UUID is enabled in there.
    Your live session is untouched — it never loads this extension.

    Close the nested window to finish. Watch this terminal for extension errors.

NOTICE

# GNOME 50 runs nested by default (--display-server is the opt-out); the old --nested flag
# is gone, and monitor sizing moved from MUTTER_DEBUG_DUMMY_MODE_SPECS to --virtual-monitor.
exec dbus-run-session -- env \
    DCONF_PROFILE="$PROFILE_FILE" \
    gnome-shell --wayland --virtual-monitor "$RESOLUTION"
