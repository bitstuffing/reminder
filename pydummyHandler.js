// SPDX-License-Identifier: MIT

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export class PydummyHandler {
    constructor() {
        this._pydummyTimeout = null;
    }

    handlePydummy(enabled) {
        if (enabled) {
            this._pydummyTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
                this._moveMouse();
                return true; // keep running
            });
        } else if (this._pydummyTimeout) {
            GLib.source_remove(this._pydummyTimeout);
            this._pydummyTimeout = null;
        }
    }

    disable() {
        if (this._pydummyTimeout) {
            GLib.source_remove(this._pydummyTimeout);
            this._pydummyTimeout = null;
        }
    }

    _moveMouse() {
        const centerX = 640;  // Screen width / 2 TODO extract screen width&height
        const centerY = 480;  // Screen height / 2
        const newX = Math.floor(Math.random() * (centerX - 50) + 50);
        const newY = Math.floor(Math.random() * (centerY - 50) + 50);
        
        // create temp python script
        const mouseSmoothness = 0.5; 
        const scriptContent = `import pyautogui\nimport time\npyautogui.moveTo(${newX}, ${newY}, duration=${mouseSmoothness})`;
        
        const tempScriptPath = GLib.build_filenamev([GLib.get_tmp_dir(), 'move_cursor.py']);
        
        try {
            GLib.file_set_contents(tempScriptPath, scriptContent);
            
            const proc = Gio.Subprocess.new(
                ['python3', tempScriptPath],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
            
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (stderr && stderr.length > 0) {
                        logError(new Error(`Error executing Python script: ${stderr}`));
                    }
                } catch (e) {
                    logError(new Error(`Failed to execute Python script: ${e.message}`));
                } finally {
                    // clean
                    try {
                        GLib.unlink(tempScriptPath);
                    } catch (e) {
                        logError(new Error(`Failed to remove temporary file: ${e.message}`));
                    }
                }
            });
            
        } catch (e) {
            logError(new Error(`Failed to write or execute script: ${e.message}`));
        }
    }
}
