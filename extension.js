import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import { PydummyHandler } from './pydummyHandler.js';
import { ReminderPreferences } from './prefs.js';

export default class ReminderExtension extends Extension {
    getSettings() {
        const schema = Gio.SettingsSchemaSource.new_from_directory(
            this.path + '/schemas',
            Gio.SettingsSchemaSource.get_default(),
            false
        );
        const schemaObj = schema.lookup('org.gnome.shell.extensions.reminder', true);
        return new Gio.Settings({ settings_schema: schemaObj });
    }
    enable() {
        this._settings = this.getSettings();

        // create panel button
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        // add label to button
        const label = new St.Label({ text: 'menu', y_align: Clutter.ActorAlign.CENTER, style_class: 'reminder-label' });
        this._indicator.add_child(label);

        // create menu for button
        this.menu = new PopupMenu.PopupMenu(this._indicator, 0.25, St.Side.TOP);
        Main.layoutManager.addTopChrome(this.menu.actor);
        this.menu.actor.hide();
        this._indicator.connect('button-press-event', () => this.menu.toggle());

        // add pydummy switch
        this.pydummyItem = new PopupMenu.PopupSwitchMenuItem(_('enable pydummy'), this._settings.get_boolean('pydummy-enabled'));
        this.pydummyItem.connect('toggled', (item) => {
            this._settings.set_boolean('pydummy-enabled', item.state);
            this.pydummyHandler.handlePydummy(item.state);
        });
        this.menu.addMenuItem(this.pydummyItem);

        // add separator
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        // add preferences
        this.preferencesItem = new PopupMenu.PopupMenuItem(_('preferences'));
        this.preferencesItem.connect('activate', () => {
            this.openPreferences();
        });
        this.menu.addMenuItem(this.preferencesItem);

        // add to panel
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // initialize pydummy
        this.pydummyHandler = new PydummyHandler(this._settings);
        this.pydummyHandler.handlePydummy(this._settings.get_boolean('pydummy-enabled'));
    }

    disable() {
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;

        this.pydummyHandler?.disable();
        this.pydummyHandler = null;
    }
}
