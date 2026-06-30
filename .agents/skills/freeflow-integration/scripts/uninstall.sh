#!/bin/bash

# FreeFlowAI Integration Uninstallation Script
# Usage: ./uninstall.sh

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$SKILL_DIR/.modified_files.log"

echo "=== FreeFlowAI Uninstaller ==="

if [ ! -f "$LOG_FILE" ] || [ ! -s "$LOG_FILE" ]; then
    echo "No installation log found or no files modified by FreeFlowAI."
    exit 0
fi

# Read files line by line and restore backups
while IFS= read -r FILE; do
    if [ -f "$FILE.freeflow.bak" ]; then
        echo "Restoring: $FILE from backup"
        mv "$FILE.freeflow.bak" "$FILE"
    else
        echo "Warning: Backup for $FILE not found, skipping."
    fi
done < "$LOG_FILE"

# Clean up log file
rm -f "$LOG_FILE"

echo "Uninstallation complete. All modified files restored to their original states."
