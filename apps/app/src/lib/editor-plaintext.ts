import type { Editor } from "@tiptap/core";

/** Canonical plaintext export — must match analyze, save, and suggest inputs. */
export function exportEditorPlaintext(editor: Editor): string {
  return editor.getText({ blockSeparator: "\n\n" });
}

/** Collapse line breaks so a rewrite stays in the same sentence/paragraph. */
export function normalizeRewriteInsertText(text: string): string {
  return text.trim().replace(/\s*\n+\s*/g, " ");
}
