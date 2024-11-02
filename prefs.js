const { Gtk, Gio, Gdk } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

let settings;

function init() {
    settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.bitstuffing.reminder');
}

function loadNotes() {
    let notesJson = settings.get_string('notes-data');
    if (notesJson) {
        return JSON.parse(notesJson);
    } else {
        return [];
    }
}

function saveNotes(notes) {
    let notesJson = JSON.stringify(notes);
    settings.set_string('notes-data', notesJson);
}

function buildPrefsWidget() {
    const notebook = new Gtk.Notebook();

    const generalBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 20,
        margin_bottom: 20,
        margin_start: 20,
        margin_end: 20,
        spacing: 10,
    });

    const grid = new Gtk.Grid({
        column_spacing: 10,
        row_spacing: 10,
    });

    const updateIntervalLabel = new Gtk.Label({
        label: "Update Interval (seconds):",
        halign: Gtk.Align.START,
    });
    const updateIntervalSpin = new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({
            lower: 1,
            upper: 60,
            step_increment: 1,
        }),
    });
    updateIntervalSpin.set_value(settings.get_int("update-interval"));
    updateIntervalSpin.connect("value-changed", (spin) => {
        settings.set_int("update-interval", spin.get_value_as_int());
    });

    grid.attach(updateIntervalLabel, 0, 0, 1, 1);
    grid.attach(updateIntervalSpin, 1, 0, 1, 1);

    const smoothnessLabel = new Gtk.Label({
        label: "Mouse Smoothness (seconds):",
        halign: Gtk.Align.START,
    });
    const smoothnessSpin = new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({
            lower: 1,
            upper: 10,
            step_increment: 1,
        }),
    });
    smoothnessSpin.set_value(settings.get_int("mouse-smoothness"));
    smoothnessSpin.connect("value-changed", (spin) => {
        settings.set_int("mouse-smoothness", spin.get_value_as_int());
    });

    grid.attach(smoothnessLabel, 0, 1, 1, 1);
    grid.attach(smoothnessSpin, 1, 1, 1, 1);

    generalBox.append(grid);
    notebook.append_page(generalBox, new Gtk.Label({ label: 'General Settings' }));

    // notes tab
    const notesBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 20,
        margin_bottom: 20,
        margin_start: 20,
        margin_end: 20,
        spacing: 10,
    });

    const scroll = new Gtk.ScrolledWindow({
        vexpand: true,
        hexpand: true,
    });
    notesBox.append(scroll);

    const notesList = new Gtk.ListBox();
    scroll.set_child(notesList);

    function updateNotesList() {
        let child = notesList.get_first_child();
        while (child !== null) {
            notesList.remove(child);
            child = notesList.get_first_child();
        }

        let notes = loadNotes();
        notes.forEach((note, index) => {
            let row = new Gtk.ListBoxRow();
            let hbox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 10 });
            row.set_child(hbox);

            let label = new Gtk.Label({
                label: note.content.substring(0, 30) + (note.content.length > 30 ? '...' : ''),
                xalign: 0,
                hexpand: true,
            });
            hbox.append(label);

            let editButton = new Gtk.Button({ label: 'Edit' });
            editButton.connect('clicked', () => {
                editNoteDialog(note, index);
            });
            hbox.append(editButton);

            let deleteButton = new Gtk.Button({ label: 'Remove' });
            deleteButton.connect('clicked', () => {
                let notes = loadNotes();
                let noteIndex = notes.findIndex(n => n.timestamp === note.timestamp);
                if (noteIndex !== -1) {
                    notes.splice(noteIndex, 1);
                    saveNotes(notes);
                    updateNotesList();
                } else {
                    // TODO: manage if note is not found
                }
            });
            hbox.append(deleteButton);
            notesList.append(row);
        });
    }

    updateNotesList();

    let deleteAllButton = new Gtk.Button({ label: 'Remove all notes' });
    deleteAllButton.connect('clicked', () => {
        let dialog = new Gtk.MessageDialog({
            transient_for: notebook.get_root(),
            modal: true,
            message_type: Gtk.MessageType.QUESTION,
            buttons: Gtk.ButtonsType.YES_NO,
            text: 'Are you sure to remove all notes?',
        });
        dialog.show();
        dialog.connect('response', (dialog, responseId) => {
            if (responseId === Gtk.ResponseType.YES) {
                saveNotes([]);
                updateNotesList();
            }
            dialog.destroy();
        });
    });
    notesBox.append(deleteAllButton);

    let reorderButton = new Gtk.Button({ label: 'Reorder notes' });
    reorderButton.connect('clicked', () => {
        let notes = loadNotes();
    
        let margin = 20;
        let noteWidth = 200; // TODO
        let noteHeight = 100; // TODO
    
        let screenWidth = 1920; //TODO : extract it
    
        // reorder notes to right
        notes.forEach((note, index) => {
            note.position.x = screenWidth - margin - noteWidth;
            note.position.y = margin + (index + 1) * (noteHeight + margin);
        });
        saveNotes(notes);
        updateNotesList();
    });    
    notesBox.append(reorderButton);

    notebook.append_page(notesBox, new Gtk.Label({ label: 'Notes' }));

    // another tab (for future features)
    const otherBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin_top: 20,
        margin_bottom: 20,
        margin_start: 20,
        margin_end: 20,
        spacing: 10,
    });
    otherBox.append(new Gtk.Label({ label: 'Additional settings can be added here.' }));
    notebook.append_page(otherBox, new Gtk.Label({ label: 'Other Settings' }));

    return notebook; 
}

function editNoteDialog(note) {
    const dialog = new Gtk.Window({
        transient_for: null,
        modal: true,
        title: 'Edit note',
        default_width: 400,
        default_height: 300,
    });

    const vbox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        spacing: 10,
        margin_top: 10,
        margin_bottom: 10,
        margin_start: 10,
        margin_end: 10,
    });
    dialog.set_child(vbox);

    const textView = new Gtk.TextView({ hexpand: true, vexpand: true });
    const buffer = textView.get_buffer();
    buffer.set_text(note.content, -1);
    vbox.append(textView);

    const buttonBox = new Gtk.Box({
        orientation: Gtk.Orientation.HORIZONTAL,
        spacing: 10,
        halign: Gtk.Align.END,
    });
    vbox.append(buttonBox);

    const cancelButton = new Gtk.Button({ label: 'Cancel' });
    const saveButton = new Gtk.Button({ label: 'Save' });

    buttonBox.append(cancelButton);
    buttonBox.append(saveButton);

    cancelButton.connect('clicked', () => {
        dialog.close();
    });

    saveButton.connect('clicked', () => {
        let startIter = buffer.get_start_iter();
        let endIter = buffer.get_end_iter();
        let text = buffer.get_text(startIter, endIter, false);

        let notes = loadNotes();
        let noteIndex = notes.findIndex(n => n.timestamp === note.timestamp);
        if (noteIndex !== -1) {
            notes[noteIndex].content = text;
            saveNotes(notes);
            updateNotesList();
        }
        dialog.close();
    });

    dialog.show();
}

function buildPrefsWidgetLegacy() {
    const mainBox = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        margin: 20,
        spacing: 10,
    });

    const intervalLabel = new Gtk.Label({
        label: "Update Interval (seconds)",
        xalign: 0,
    });
    mainBox.append(intervalLabel);

    const intervalSpin = new Gtk.SpinButton({
        adjustment: new Gtk.Adjustment({
            value: settings.get_int('update-interval'),
            lower: 1,
            upper: 60,
            step_increment: 1,
        }),
        numeric: true,
    });
    intervalSpin.connect('value-changed', (spinButton) => {
        settings.set_int('update-interval', spinButton.get_value_as_int());
    });
    mainBox.append(intervalSpin);
    
    return mainBox;
}

function saveSettings() {

}

function onDestroy() {
  
}
