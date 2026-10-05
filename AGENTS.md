# AGENTS.md

## Desktop UI Validation

Prosodeus editor and inspector work is a desktop/Electron workflow. Do not validate document, editor, inspector, Rewrite, Operations, or Versions UI by opening the generic Vite web shell in a browser.

Use the Electron debug target for UI validation:

```bash
bun run dev:desktop:debug
agent-browser --cdp 9222 snapshot -i
```

`dev:desktop:debug` starts the dev API, the Vite app, and the Electron shell with `--remote-debugging-port=9222`. Browser checks against `http://127.0.0.1:5173/` only prove the web entrypoint responds; they do not validate the desktop editor surface unless the task is explicitly about the standalone web shell.

For desktop/editor UI changes, acceptable verification is:

- typecheck/tests/build for code correctness
- Electron renderer inspection through `agent-browser --cdp 9222 snapshot -i`
- a clear note when the desktop document state cannot be reached

Do not present a generic web-shell smoke check as validation for a desktop/editor change.
