import GLib from 'gi://GLib';
import Gio from 'gi://Gio';

export class PydummyHandler {
    constructor(settings) {
        this._pydummyTimeout = null;
        this._settings = settings;
    }

    handlePydummy(enabled) {
        if (enabled) {
            const frequency = this._settings.get_int('update-interval');
            this._pydummyTimeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, frequency, () => {
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
        // screen center
        const centerX = 640;  
        const centerY = 480;  
        const newX = Math.floor(Math.random() * (centerX - 50) + 50);
        const newY = Math.floor(Math.random() * (centerY - 50) + 50);
        
        const mouseSmoothness = this._settings.get_double('mouse-smoothness');
        
        const scriptContent = `import pyautogui\nimport time\npyautogui.moveTo(${newX}, ${newY}, duration=${mouseSmoothness})`;
        const tempScriptPath = GLib.build_filenamev([GLib.get_tmp_dir(), 'move_cursor.py']);
        
        try {
            GLib.file_set_contents(tempScriptPath, scriptContent);
            
            // run python script
            const proc = Gio.Subprocess.new(
                ['python3', tempScriptPath],
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE
            );
            
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    const [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if (stderr && stderr.length > 0) {
                        logError(new Error(`script error: ${stderr}`));
                    }
                } catch (e) {
                    logError(new Error(`run failed: ${e.message}`));
                } finally {
                    try {
                        GLib.unlink(tempScriptPath);
                    } catch (e) {
                        logError(new Error(`cleanup failed: ${e.message}`));
                    }
                }
            });
            
        } catch (e) {
            logError(new Error(`script failed: ${e.message}`));
        }
    }
}
