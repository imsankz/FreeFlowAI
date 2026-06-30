#!/bin/bash

# FreeFlowAI Integration Installation Script
# Usage: ./install.sh <PROXY_URL> [PROXY_SECRET_TOKEN]

PROXY_URL=${1:-"http://localhost:3000/v1"}
PROXY_TOKEN=${2:-""}

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$SKILL_DIR/.modified_files.log"

# Clear or create the log file
> "$LOG_FILE"

echo "=== FreeFlowAI Installer ==="
echo "Configuring proxy URL: $PROXY_URL"

# 1. Update or create environment files (.env or .env.local)
ENV_FILE=""
if [ -f ".env.local" ]; then
    ENV_FILE=".env.local"
elif [ -f ".env" ]; then
    ENV_FILE=".env"
else
    ENV_FILE=".env"
    touch "$ENV_FILE"
fi

# Backup the env file
cp "$ENV_FILE" "$ENV_FILE.freeflow.bak"
echo "$ENV_FILE" >> "$LOG_FILE"

# Remove existing FREEFLOW variables to avoid duplicates
sed -i.bak '/FREEFLOW_PROXY_URL/d' "$ENV_FILE" 2>/dev/null || sed -i '' '/FREEFLOW_PROXY_URL/d' "$ENV_FILE"
sed -i.bak '/FREEFLOW_PROXY_TOKEN/d' "$ENV_FILE" 2>/dev/null || sed -i '' '/FREEFLOW_PROXY_TOKEN/d' "$ENV_FILE"
rm -f "$ENV_FILE.bak"

# Append new variables
echo "" >> "$ENV_FILE"
echo "FREEFLOW_PROXY_URL=\"$PROXY_URL\"" >> "$ENV_FILE"
if [ -n "$PROXY_TOKEN" ]; then
    echo "FREEFLOW_PROXY_TOKEN=\"$PROXY_TOKEN\"" >> "$ENV_FILE"
fi

echo "Updated $ENV_FILE with FreeFlowAI environment variables."

# 2. Find and wrap client instances in Javascript/TypeScript/Python
echo "Scanning codebase for OpenAI client instantiations..."

# Find all matching files (js, ts, py), ignoring node_modules and .git
FILES=$(find . -type f \( -name "*.js" -o -name "*.ts" -o -name "*.py" \) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/.agents/*")

for FILE in $FILES; do
    # Check if the file instantiates an OpenAI client
    if grep -q "new OpenAI(" "$FILE" 2>/dev/null || grep -q "OpenAI(" "$FILE" 2>/dev/null; then
        echo "Found OpenAI client in: $FILE"
        
        # Create a backup of the file
        cp "$FILE" "$FILE.freeflow.bak"
        echo "$FILE" >> "$LOG_FILE"
        
        # In JavaScript/TypeScript, attempt to swap or add baseURL/apiKey
        # Since code can be multi-line or varied, we will replace common instantiation patterns:
        # e.g., 'new OpenAI({' -> 'new OpenAI({ baseURL: process.env.FREEFLOW_PROXY_URL, apiKey: process.env.FREEFLOW_PROXY_TOKEN || "not-needed",'
        if [[ "$FILE" == *.js || "$FILE" == *.ts ]]; then
            # Replace pattern
            sed -i.bak 's/new OpenAI({/new OpenAI({ baseURL: process.env.FREEFLOW_PROXY_URL, apiKey: process.env.FREEFLOW_PROXY_TOKEN || "not-needed",/g' "$FILE" 2>/dev/null || \
            sed -i '' 's/new OpenAI({/new OpenAI({ baseURL: process.env.FREEFLOW_PROXY_URL, apiKey: process.env.FREEFLOW_PROXY_TOKEN || "not-needed",/g' "$FILE"
            rm -f "$FILE.bak"
        fi
        
        # In Python, do the same for OpenAI(
        if [[ "$FILE" == *.py ]]; then
            sed -i.bak 's/OpenAI(/OpenAI(base_url=os.environ.get("FREEFLOW_PROXY_URL"), api_key=os.environ.get("FREEFLOW_PROXY_TOKEN", "not-needed"),/g' "$FILE" 2>/dev/null || \
            sed -i '' 's/OpenAI(/OpenAI(base_url=os.environ.get("FREEFLOW_PROXY_URL"), api_key=os.environ.get("FREEFLOW_PROXY_TOKEN", "not-needed"),/g' "$FILE"
            rm -f "$FILE.bak"
        fi
    fi
done

echo "Integration complete. Check your diffs to verify the wrapper changes."
echo "Original files backed up with .freeflow.bak extensions."
