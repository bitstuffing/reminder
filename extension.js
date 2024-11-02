// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import GLib from 'gi://GLib';
import { PydummyHandler } from './pydummyHandler.js';

export default class ReminderExtension extends Extension {
    enable() {
        // Create a panel button
        this._indicator = new PanelMenu.Button(0.0, this.metadata.name, false);

        // Add a label to the panel button
        const label = new St.Label({ text: 'Menu', y_align: Clutter.ActorAlign.CENTER, style_class: 'reminder-label' });
        this._indicator.add_child(label);

        // Create a new menu for the button
        this.menu = new PopupMenu.PopupMenu(this._indicator, 0.25, St.Side.TOP);
        Main.layoutManager.addTopChrome(this.menu.actor);
        this.menu.actor.hide();
        this._indicator.connect('button-press-event', () => this.menu.toggle());

        // Add a checkbox to the menu for "Pydummy"
        this.pydummyItem = new PopupMenu.PopupSwitchMenuItem(_('Enable Pydummy'), this.getSettings().get_boolean('pydummy-enabled'));
        this.pydummyItem.connect('toggled', (item) => {
            this.getSettings().set_boolean('pydummy-enabled', item.state);
            this.pydummyHandler.handlePydummy(item.state);
        });
        this.menu.addMenuItem(this.pydummyItem);

        // Add the indicator to the panel
        Main.panel.addToStatusArea(this.uuid, this._indicator);

        // Initialize PydummyHandler and handle initial state for Pydummy
        this.pydummyHandler = new PydummyHandler();
        this.pydummyHandler.handlePydummy(this.getSettings().get_boolean('pydummy-enabled'));
    }

    disable() {
        // Remove the button from the status bar
        this._indicator?.destroy();
        this._indicator = null;
        this._settings = null;

        // Remove any Pydummy-related operations
        this.pydummyHandler?.disable();
        this.pydummyHandler = null;
    }
}
