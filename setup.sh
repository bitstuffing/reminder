#!/bin/bash

EXTENSION_DIR="$HOME/.local/share/gnome-shell/extensions/reminder@bitstuffing.github.io"

function install_extension() {
    if [ ! -d "$EXTENSION_DIR" ]; then
        mkdir -p "$EXTENSION_DIR"
    fi

    cp ./metadata.json "$EXTENSION_DIR/metadata.json"
    cp ./stylesheet.css "$EXTENSION_DIR/stylesheet.css"
    cp ./extension.js "$EXTENSION_DIR/extension.js"
    cp ./prefs.js "$EXTENSION_DIR/prefs.js"
    cp ./pydummyHandler.js "$EXTENSION_DIR/pydummyHandler.js"
    cp -r schemas "$EXTENSION_DIR/schemas"

    gnome-extensions enable reminder@bitstuffing.github.io

    echo "Restart GNOME Shell (Alt+F2, luego 'r' y Enter)"

    echo "Install complete"
}

function uninstall_extension() {
    gnome-extensions disable reminder@bitstuffing.github.io
    rm -rf "$EXTENSION_DIR"
    echo "Extension uninstalled"
}

function reinstall_extension() {
    uninstall_extension
    install_extension
}

# Menu
echo "Make a choice:"
echo "1) Install"
echo "2) Reinstall"
echo "3) Uninstall"
read -p "Choice: " option

case $option in
    1)
        install_extension
        ;;
    2)
        reinstall_extension
        ;;
    3)
        uninstall_extension
        ;;
    *)
        echo "Invalid option."
        ;;
esac
