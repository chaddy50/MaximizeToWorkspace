import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

/**
 * Runs in a plain GTK process rather than inside the shell, so nothing here may import
 * Meta, Clutter, St, or anything under resource:///org/gnome/shell/ui/.
 */
export default class MaximizeToWorkspacePreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage({
            title: 'Maximize To Workspace',
            icon_name: 'view-fullscreen-symbolic',
        });

        page.add(this._buildBehaviorGroup(settings));
        page.add(this._buildNewWindowsGroup(settings));
        page.add(this._buildAdvancedGroup(settings));

        window.add(page);
    }

    _buildBehaviorGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: 'Behavior',
            description: 'What happens when a window is maximized or restored.',
        });

        this._addSwitchRow(group, settings, 'force-fullscreen',
            'Force fullscreen',
            'Hide the top bar once the window is on its own workspace.');

        this._addSwitchRow(group, settings, 'return-on-minimize',
            'Return home on minimize',
            'Minimizing a window moves it back to the home workspace.');

        this._addSwitchRow(group, settings, 'return-on-unmaximize',
            'Return home on un-maximize',
            'Un-maximizing or leaving fullscreen moves the window back to the home workspace.');

        return group;
    }

    _buildNewWindowsGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: 'New windows',
            description: 'What happens when a new application window opens.',
        });

        this._addSwitchRow(group, settings, 'move-new-windows-home',
            'Move new windows home',
            'Newly opened windows are moved to the home workspace and the view follows.');

        return group;
    }

    _buildAdvancedGroup(settings) {
        const group = new Adw.PreferencesGroup({
            title: 'Advanced',
            description: 'Change these only if the defaults do not suit your setup.',
        });

        this._addSpinRow(group, settings, 'home-workspace-index',
            'Home workspace',
            'Counted from zero, so 0 is the first workspace. Never receives a fullscreen ' +
            'window; new windows land here too.',
            0, 31, 1);

        this._addSpinRow(group, settings, 'startup-delay-ms',
            'Startup delay',
            'Milliseconds to wait after login before moving any window.',
            0, 30000, 500);

        return group;
    }

    _addSwitchRow(group, settings, key, title, subtitle) {
        const row = new Adw.SwitchRow({title, subtitle});
        group.add(row);
        settings.bind(key, row, 'active', Gio.SettingsBindFlags.DEFAULT);
    }

    _addSpinRow(group, settings, key, title, subtitle, lower, upper, stepIncrement) {
        const row = Adw.SpinRow.new_with_range(lower, upper, stepIncrement);
        row.title = title;
        row.subtitle = subtitle;
        group.add(row);
        settings.bind(key, row, 'value', Gio.SettingsBindFlags.DEFAULT);
    }
}
