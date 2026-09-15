#!/usr/bin/env bash
set -euo pipefail

UUID="maximize-to-workspace@nchaddy.github.io"
SOURCE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$UUID"
TARGET_DIR="$HOME/.local/share/gnome-shell/extensions/$UUID"

if [[ ! -d "$SOURCE_DIR" ]]; then
    echo "error: extension source not found at $SOURCE_DIR" >&2
    exit 1
fi

echo "Compiling schemas..."
glib-compile-schemas "$SOURCE_DIR/schemas/"

echo "Installing to $TARGET_DIR..."
rm -rf "$TARGET_DIR"
mkdir -p "$(dirname "$TARGET_DIR")"
cp -r "$SOURCE_DIR" "$TARGET_DIR"

echo "Enabling $UUID..."
gnome-extensions enable "$UUID"

echo
echo "Installed."

CONFLICTING_UUIDS=(
    MaximizeWindowIntoNewWorkspace@kyleross.com
    maximize-workspace-history@amancode22.github.com
)
ENABLED_CONFLICTS=()
for conflict in "${CONFLICTING_UUIDS[@]}"; do
    if gnome-extensions list --enabled | grep -qx "$conflict"; then
        ENABLED_CONFLICTS+=("$conflict")
    fi
done

if [[ ${#ENABLED_CONFLICTS[@]} -gt 0 ]]; then
    echo
    echo "These enabled extensions hook the same window-manager signals and will fight"
    echo "this one. Disable them first:"
    echo
    for conflict in "${ENABLED_CONFLICTS[@]}"; do
        echo "    gnome-extensions disable $conflict"
    done
fi

cat <<'NOTICE'

This is a Wayland session, so new extension code only loads after a logout/login.
(Alt+F2 -> "r" restarts the shell on X11 only.)

To try it without disturbing this session, run a nested shell instead:

    dbus-run-session -- gnome-shell --nested --wayland

NOTICE
