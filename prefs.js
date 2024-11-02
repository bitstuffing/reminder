// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import Adw from 'gi://Adw';
import { ExtensionPreferences, gettext as _ } from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export default class ReminderPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        // Create a preferences page with a single group
        const page = new Adw.PreferencesPage({
            title: _('General'),
            icon_name: 'dialog-information-symbolic',
        });
        window.add(page);

        const group = new Adw.PreferencesGroup({
            title: _('Features'),
            description: _('Configure the available features of the Reminder extension'),
        });
        page.add(group);

        // Create a new preferences row for "Pydummy"
        const pydummyRow = new Adw.SwitchRow({
            title: _('Enable Pydummy'),
            subtitle: _('Automatically move the mouse to keep the system active'),
        });
        group.add(pydummyRow);

        // Create a settings object and bind the row to the "pydummy-enabled" key
        window._settings = this.getSettings();
        window._settings.bind('pydummy-enabled', pydummyRow, 'active', Gio.SettingsBindFlags.DEFAULT);
    }
}
