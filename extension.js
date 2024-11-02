const { St, Clutter, GLib, Gio, Pango } = imports.gi;
const Main = imports.ui.main;
const PopupMenu = imports.ui.popupMenu;
const PanelMenu = imports.ui.panelMenu;
const ModalDialog = imports.ui.modalDialog;
const DND = imports.ui.dnd;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

let panelButton, moveInterval, menuItem;
let movementActive = false; // disable pydummy functionality at startup
let globalClickSignal, clipboardManager;
let clipboardItems = [];
let suppressNotesUpdate = false;
let settings = ExtensionUtils.getSettings();
let notes = [];

function init() {
    settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.bitstuffing.reminder');
    
    // Load settings values
    let updateInterval = settings.get_int('update-interval');  // Interval for updating in seconds
    let mouseSmoothness = settings.get_int('mouse-smoothness');  // Duration of mouse movement in seconds

    panelButton = new PanelMenu.Button(0.0, Me.metadata.uuid, false);
    let panelButtonText = new St.Label({
        text: "Menu",
        y_align: Clutter.ActorAlign.CENTER,
    });
    panelButton.add_actor(panelButtonText);

    menuItem = new PopupMenu.PopupSwitchMenuItem('pydummy', movementActive);
    menuItem.connect('toggled', (item, state) => {
        movementActive = state;
        if (movementActive) {
            startMovement(updateInterval, mouseSmoothness);
        } else {
            stopMovement();
        }
    });
    panelButton.menu.addMenuItem(menuItem);
    panelButton.menu.actor.set_style_class_name('popup-menu');

    clipboardManager = new PopupMenu.PopupSubMenuMenuItem('Clipboard');
    panelButton.menu.addMenuItem(clipboardManager);

    let notesManager = new PopupMenu.PopupSubMenuMenuItem('Notess');
    panelButton.menu.addMenuItem(notesManager);

    let showNotesItem = new PopupMenu.PopupSwitchMenuItem('Show notes', true);
    notesManager.menu.addMenuItem(showNotesItem);

    showNotesItem.connect('toggled', (item, state) => {
        if (state) {
            showAllNotes();
        } else {
            hideAllNotes();
        }
    });

    let addNoteItem = new PopupMenu.PopupMenuItem('Add note');
    notesManager.menu.addMenuItem(addNoteItem);
    addNoteItem.connect('activate', () => {
        createNewNote();
    });

    let separator = new PopupMenu.PopupSeparatorMenuItem();
    panelButton.menu.addMenuItem(separator);

    let preferencesItem = new PopupMenu.PopupMenuItem('Preferences');
    panelButton.menu.addMenuItem(preferencesItem);

    preferencesItem.connect('activate', () => {
        Gio.Subprocess.new([
            'gnome-shell-extension-prefs', Me.metadata.uuid
        ], Gio.SubprocessFlags.NONE);
    });

    const clipboard = St.Clipboard.get_default();

    function updateClipboard() {
        clipboard.get_text(St.ClipboardType.CLIPBOARD, (clipboard, text) => {
            if (text && text !== "" && (clipboardItems.length === 0 || clipboardItems.indexOf(text) === -1)) {
                const existingIndex = clipboardItems.indexOf(text);
                if (existingIndex !== -1) {
                    clipboardItems.splice(existingIndex, 1);
                }
                clipboardItems.unshift(text);
                updateClipboardMenu();
            }
        });
    }

    function updateClipboardMenu() {
        clipboardManager.menu.removeAll();
        clipboardItems.forEach((item, index) => {
            let menuItem = new PopupMenu.PopupMenuItem(`${index + 1}: ${item.substring(0, 30)}`);

            let copyButton = new St.Button({
                child: new St.Icon({
                    icon_name: 'edit-copy-symbolic',
                    style_class: 'system-status-icon',
                    icon_size: 16
                }),
                x_align: St.Align.END,
            });
            copyButton.connect('clicked', () => {
                clipboard.set_text(St.ClipboardType.CLIPBOARD, item);
                const existingIndex = clipboardItems.indexOf(item);
                if (existingIndex !== -1) {
                    clipboardItems.splice(existingIndex, 1);
                }
                clipboardItems.unshift(item);
                updateClipboardMenu();
            });

            let deleteButton = new St.Button({
                child: new St.Icon({
                    icon_name: 'user-trash-symbolic',
                    style_class: 'system-status-icon',
                    icon_size: 16
                }),
                x_align: St.Align.END,
            });
            deleteButton.connect('clicked', () => {
                clipboardItems.splice(index, 1);
                clipboard.set_text(St.ClipboardType.CLIPBOARD, "");
                updateClipboardMenu();
            });

            let box = new St.BoxLayout({ vertical: false });
            let label = new St.Label({ text: `${index + 1}: ${item.substring(0, 30)}` });
            box.add_child(label);
            box.add_child(copyButton);
            box.add_child(deleteButton);
            menuItem.actor.add_child(box);
            deleteButton.set_x_align(Clutter.ActorAlign.END);
            clipboardManager.menu.addMenuItem(menuItem);
        });
    }

    GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
        if (!clipboardManager.menu.isOpen) {
            updateClipboard();
        }
        return true;
    });
    
}

function createNewNote2() {
    let noteDialog = new ModalDialog.ModalDialog({ styleClass: 'note-dialog' });

    let content = new St.BoxLayout({ vertical: true, style_class: 'note-content' });

    let textView = new St.Widget({
        style_class: 'note-textview',
        reactive: true,
        can_focus: true,
        x_expand: true,
        y_expand: true,
    });

    let clutterText = new Clutter.Text({
        editable: true,
        single_line_mode: false,
        line_wrap: true,
        line_wrap_mode: Pango.WrapMode.WORD_CHAR,
        text: '',
    });

    textView.set_child(clutterText);

    content.add_actor(textView);
    noteDialog.contentLayout.add_actor(content);

    noteDialog.setButtons([
        {
            label: 'Save',
            action: () => {
                let noteText = clutterText.get_text();
                saveNote({
                    content: noteText,
                    position: { x: 100, y: 100 },
                    timestamp: Date.now(),
                });
                noteDialog.close();
            },
        },
        {
            label: 'Cancel',
            action: () => {
                noteDialog.close();
            },
            key: Clutter.KEY_Escape,
        },
    ]);

    noteDialog.open();

    clutterText.grab_key_focus();
}


function saveNote(note) {
    notes.push(note);
    persistNotes();
    displayNoteOnDesktop(note);
}

function persistNotes() {
    suppressNotesUpdate = true;
    let notesJson = JSON.stringify(notes);
    settings.set_string('notes-data', notesJson);
    suppressNotesUpdate = false;
}


function loadNotes() {
    let notesJson = settings.get_string('notes-data');
    if (notesJson) {
        notes = JSON.parse(notesJson);
        notes.forEach(note => {
            displayNoteOnDesktop(note);
        });
    } else {
        notes = [];
    }
}

function saveNotes(notes) {
    let notesJson = JSON.stringify(notes);
    settings.set_string('notes-data', notesJson);
}

function showAllNotes() {
    notes.forEach(note => {
        if (note.actor) {
            note.actor.visible = true;
            note.actor.reactive = true;
        }
    });
}

function hideAllNotes() {
    notes.forEach(note => {
        if (note.actor) {
            note.actor.visible = false;
            note.actor.reactive = false;
        }
    });
}

function displayNoteOnDesktop(note) {
    if (note.actor) { // exists, so skip it
        return;
    }

    let noteActor = new St.Widget({
        style_class: 'note-actor',
        reactive: true,
        can_focus: true,
        track_hover: true,
        layout_manager: new Clutter.BoxLayout(),
    });

    noteActor.set_translation(note.position.x, note.position.y, 0);

    let noteLabel = new St.Label({
        text: note.content,
        style_class: 'note-label',
    });

    noteActor.add_child(noteLabel);

    Main.layoutManager.uiGroup.add_child(noteActor);
    note.actor = noteActor;

    makeActorDraggable(noteActor, note);
}

function makeActorDraggable(actor, note) {
    let dragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    let capturedEventId = null;

    actor.connect('button-press-event', (actor, event) => {
        if (event.get_button() === 1) { // left click
            let [stageX, stageY] = global.get_pointer();
            let [actorX, actorY] = actor.get_transformed_position();

            dragOffsetX = actorX - stageX;
            dragOffsetY = actorY - stageY;
            dragging = true;

            // connect captured-event to global scenario
            capturedEventId = global.stage.connect('captured-event', (stage, event) => {
                let eventType = event.type();
                if (eventType === Clutter.EventType.MOTION && dragging) {
                    let [newX, newY] = global.get_pointer();
                    actor.set_translation(newX + dragOffsetX, newY + dragOffsetY, 0);
                    // updates note position
                    note.position.x = newX + dragOffsetX;
                    note.position.y = newY + dragOffsetY;
                    return Clutter.EVENT_STOP;
                } else if (eventType === Clutter.EventType.BUTTON_RELEASE && dragging) {
                    if (event.get_button() === 1) {
                        endDrag();
                    }
                    return Clutter.EVENT_STOP;
                } else if (eventType === Clutter.EventType.KEY_PRESS && dragging) {
                    // scape key cancel drag movement
                    if (event.get_key_symbol() === Clutter.KEY_Escape) {
                        endDrag();
                    }
                    return Clutter.EVENT_STOP;
                }
                return Clutter.EVENT_PROPAGATE;
            });

            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    });

    function endDrag() {
        dragging = false;
        // disconnect event
        if (capturedEventId) {
            global.stage.disconnect(capturedEventId);
            capturedEventId = null;
        }
        // store note position
        persistNotes();
    }
}

function createNewNote() {
    let noteDialog = new ModalDialog.ModalDialog({ styleClass: 'note-dialog' });

    let content = new St.BoxLayout({
        vertical: true,
        style_class: 'note-content',
        x_expand: true,
        y_expand: true,
    });

    let textEntry = new St.Entry({
        style_class: 'note-textview',
        text: '',
        can_focus: true,
        x_expand: true,
        y_expand: true,
    });

    let clutterText = textEntry.clutter_text;
    clutterText.set_single_line_mode(false);
    clutterText.set_line_wrap(true);
    clutterText.set_line_wrap_mode(Pango.WrapMode.WORD_CHAR);

    clutterText.connect('key-press-event', (actor, event) => {
        let symbol = event.get_key_symbol();
        if (symbol === Clutter.KEY_Return || symbol === Clutter.KEY_KP_Enter) {
            clutterText.insert_text('\n', clutterText.get_cursor_position());
            return Clutter.EVENT_STOP;
        }
        return Clutter.EVENT_PROPAGATE;
    });

    content.add_actor(textEntry);
    noteDialog.contentLayout.add_actor(content);

    noteDialog.setButtons([
        {
            label: 'Save',
            action: () => {
                let noteText = textEntry.get_text();
                saveNote({
                    content: noteText,
                    position: { x: 100, y: 100, z: 1000 },
                    timestamp: Date.now(),
                });
                noteDialog.close();
            },
        },
        {
            label: 'Cancel',
            action: () => {
                noteDialog.close();
            },
            key: Clutter.KEY_Escape,
        },
    ]);

    noteDialog.open();

    clutterText.grab_key_focus();
}

function editNoteDialog(note, index) {
    const dialog = new Gtk.Dialog({
        transient_for: null,
        modal: true,
        title: 'Edit note',
    });

    dialog.add_button('Cancel', Gtk.ResponseType.CANCEL);
    dialog.add_button('Save', Gtk.ResponseType.OK);

    const contentArea = dialog.get_content_area();
    const textView = new Gtk.TextView({ hexpand: true, vexpand: true });
    const buffer = textView.get_buffer();
    buffer.set_text(note.content, -1);

    contentArea.append(textView);
    dialog.set_default_size(400, 300);

    dialog.show();
    dialog.present();

    dialog.connect('response', (dialog, responseId) => {
        if (responseId === Gtk.ResponseType.OK) {
            let startIter = buffer.get_start_iter();
            let endIter = buffer.get_end_iter();
            let text = buffer.get_text(startIter, endIter, true);

            let notes = loadNotes();
            // seek by 'timestamp'
            let noteIndex = notes.findIndex(n => n.timestamp === note.timestamp);
            if (noteIndex !== -1) {
                notes[noteIndex].content = text; // update content
                saveNotes(notes);
                updateNotesList();
            } else {
                //TODO: in case of note not found
            }
        }
        dialog.close(); // 'destroy()' doesn't work in GTK4
    });
}

function deleteNoteActor(note) {
    if (note.actor) {
        note.actor.destroy();
    }
    notes = notes.filter(n => n !== note);
    persistNotes();
}

function isNoteActor(actor) {
    if (!actor || !(actor instanceof Clutter.Actor)) {
        return false;
    }

    for (let note of notes) {
        if (note.actor && (actor === note.actor || note.actor.contains(actor))) {
            return true;
        }
    }
    return false;
}

function isPanelActor(actor) {
    if (!actor || !(actor instanceof Clutter.Actor)) {
        return false;
    }
    return actor === panelButton || panelButton.contains(actor);
}

function updateNotesFromSettings() {
    if (suppressNotesUpdate) {
        return;
    }

    let updatedNotesData = settings.get_string('notes-data');
    let updatedNotes = updatedNotesData ? JSON.parse(updatedNotesData) : [];

    // map notes by timestamp
    let updatedNotesMap = new Map();
    updatedNotes.forEach(noteData => {
        updatedNotesMap.set(noteData.timestamp, noteData);
    });

    // update existing notes by timestamp
    let updatedTimestamps = new Set();

    notes.forEach(note => {
        let updatedNoteData = updatedNotesMap.get(note.timestamp);
        if (updatedNoteData) {
            // update content and position
            note.content = updatedNoteData.content;
            note.position = updatedNoteData.position;

            // update actor
            if (note.actor) {
                log(`note.actor: ${note.actor}`);
                log(`note.actor methods: ${Object.getOwnPropertyNames(note.actor.__proto__).join(', ')}`);
            
            
                if (typeof note.actor.set_translation === 'function') {
                    note.actor.set_translation(note.position.x, note.position.y, 0);
                }
                let noteLabel = note.actor.get_child_at_index(0);
                if (noteLabel && noteLabel instanceof St.Label) {
                    noteLabel.set_text(note.content);
                }
            }
            updatedTimestamps.add(note.timestamp);
        } else {
            // note doesn't exists, so needs to be removed (persistence)
            if (note.actor) {
                try {
                    // remove children actor
                    if (typeof note.actor.destroy_all_children === 'function') {
                        note.actor.destroy_all_children();
                    }
                    // remove actor
                    if (typeof note.actor.dispose === 'function') {
                        note.actor.dispose();
                    } else if (typeof note.actor.destroy === 'function') {
                        note.actor.destroy();
                    } else if (typeof note.actor.unparent === 'function') {
                        note.actor.unparent();
                    } else {
                        log('Could not remove actor note');
                    }
                } catch (e) {
                    log(`Error trying to remove actor note: ${e}`);
                }
            }            
            
        }
    });

    // add new notes
    updatedNotes.forEach(noteData => {
        if (!updatedTimestamps.has(noteData.timestamp)) {
            displayNoteOnDesktop(noteData);
            notes.push(noteData);
        }
    });

    // remove notes out of 'updatedNotes'
    notes = notes.filter(note => {
        return updatedNotesMap.has(note.timestamp);
    });
}

let globalEventId;
let windowSwitchEventId;

function enable() {
    Main.panel.addToStatusArea('my-widget', panelButton);

    let updateInterval = settings.get_int('update-interval');
    let mouseSmoothness = settings.get_int('mouse-smoothness');

    startMovement(updateInterval, mouseSmoothness);

    globalClickSignal = global.stage.connect('captured-event', (actor, event) => {
        if (event.type() === Clutter.EventType.BUTTON_PRESS || event.type() === Clutter.EventType.TOUCH_BEGIN) {
            stopMovement();
            movementActive = false;
            if (menuItem) {
                menuItem.setToggleState(false); 
            }
        }
    });

    loadNotes();
    /*
    globalEventId = global.stage.connect('captured-event', (actor, event) => {
        let eventType = event.type();
        if (eventType === Clutter.EventType.BUTTON_PRESS) {
            let target = event.get_source();
            if (target && target instanceof Clutter.Actor) {
                // Si el clic no es sobre una nota o el panel, ocultar las notas
                if (!isNoteActor(target) && !isPanelActor(target)) {
                    hideAllNotes();
                }
            } else {
                // Si no se pudo obtener un actor válido, considerar ocultar las notas
                hideAllNotes();
            }
        }
        return Clutter.EVENT_PROPAGATE;
    }); 

    windowSwitchEventId = global.display.connect('notify::focus-window', () => {
        // Ocultar las notas al cambiar de ventana
        hideAllNotes();
    });

    */

    // connect signal 'notes-data'
    settings.connect('changed::notes-data', () => {
        updateNotesFromSettings();
    });

}

function disable() {
    if (panelButton) {
        panelButton.destroy();
    }
    panelButton = null;

    stopMovement();

    if (globalClickSignal) {
        global.stage.disconnect(globalClickSignal);
        globalClickSignal = null;
    }

    notes.forEach(note => {
        if (note.actor) {
            note.actor.destroy();
            note.actor = null;
        }
    });
    notes = [];

    if (globalEventId) {
        global.stage.disconnect(globalEventId);
        globalEventId = null;
    }

    if (windowSwitchEventId) {
        global.display.disconnect(windowSwitchEventId);
        windowSwitchEventId = null;
    }
    
}

function startMovement(updateInterval, mouseSmoothness) {
    if (!movementActive || moveInterval) {
        return;
    }
    moveInterval = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, updateInterval, () => {
        performMovement(mouseSmoothness);
        return true; // keep interval active
    });
}

function stopMovement() {
    if (moveInterval) {
        GLib.Source.remove(moveInterval);
        moveInterval = null;
    }
}

function performMovement(mouseSmoothness) {
    // cursor movement
    log('Performing cursor movement...');
    const centerX = 640;  // Screen of 1080p: width / 2
    const centerY = 480;  // Screen of 1080p: height / 2

    const newX = Math.floor(Math.random() * (centerX - 50) + 50);
    const newY = Math.floor(Math.random() * (centerY - 50) + 50);

    log(`Moving cursor from (${centerX}, ${centerY}) to (${newX}, ${newY})`);

    // create a temporary file for the Python script
    const tempScriptPath = GLibFileUtils.build_filenamev([GLibFileUtils.get_tmp_dir(), 'move_cursor.py']);
    const scriptContent = `import pyautogui; import time; pyautogui.moveTo(${newX}, ${newY}, duration=${mouseSmoothness})`;
    GLibFileUtils.file_set_contents(tempScriptPath, scriptContent);

    // execute the Python script from the temporary file in a non-blocking way
    let subprocess = Gio.Subprocess.new(
        ["python3", tempScriptPath],
        Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
    );

    // handle process completion to capture errors
    subprocess.communicate_utf8_async(null, null, (proc, res) => {
        try {
            let [, stdout, stderr] = proc.communicate_utf8_finish(res);
            if (stderr) {
                log(`Error executing Python script: ${stderr}`);
            } else {
                log(`Python script output: ${stdout}`);
            }
        } catch (e) {
            log(`Error in process execution: ${e.message}`);
        }
    });
}
