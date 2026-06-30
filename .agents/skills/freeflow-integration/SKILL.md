---
name: freeflow-integration
description: Easily install, plug, or cleanly uninstall FreeFlowAI proxy client routing in any repository.
---

# FreeFlowAI Integration Skill

This skill allows Antigravity agents to automatically plug FreeFlowAI (the zero-config, self-healing free-tier LLM/Image router) into any target codebase, or cleanly uninstall/unplug it.

## When to Use
- When a user asks to "install FreeFlowAI", "integrate free-tier router", or "plug FreeFlowAI" into their codebase.
- When a user asks to "uninstall FreeFlowAI", "remove proxy config", or "restore original OpenAI client" in their codebase.

## Capabilities

1. **Automatic Code Inspection**: Scan the repository to locate where standard AI client SDKs (OpenAI, Hugging Face, Google Gen AI) are instantiated.
2. **Environment Configuration**: Automatically generate or append proxy variables to the `.env` or `.env.local` files.
3. **Clean Code Modification**: Update existing AI clients to target the local or hosted FreeFlowAI endpoint instead of the direct provider endpoint.
4. **Clean Uninstallation**: Revert all code modifications back to the original client setup, remove the specific env vars, and clean up proxy dependencies.

## Instructions for Agents

### To Install/Plug FreeFlowAI:
1. Scan the repo for occurrences of `new OpenAI(`, `OpenAI(`, `new OpenAIClient(`, or `createOpenAI(`.
2. If none are found, ask the user if they want to install it as a standalone script or API route.
3. Ask the user for their FreeFlowAI Proxy Base URL (default is `http://localhost:3000/v1` for local setup).
4. Run the install script:
   ```bash
   bash .agents/skills/freeflow-integration/scripts/install.sh <PROXY_URL> <OPTIONAL_PROXY_SECRET_TOKEN>
   ```
5. Commit the wrapper configurations. If they use JS/TS, modify client instances to use the local/hosted proxy configuration.

### To Uninstall/Unplug FreeFlowAI:
1. Run the uninstall script:
   ```bash
   bash .agents/skills/freeflow-integration/scripts/uninstall.sh
   ```
2. The script will restore the backup files saved during installation.
3. Verify that the codebase builds and compiles successfully after uninstallation.
