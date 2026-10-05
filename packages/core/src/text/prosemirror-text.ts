/**
 * Server-side plain text extraction from ProseMirror JSON documents.
 * Used in the Durable Object when it needs to extract plain text
 * without a browser-side Tiptap editor instance.
 *
 * Produces output compatible with splitAndHash() — block nodes
 * are joined with \n\n, same as editor.getText({ blockSeparator: '\n\n' }).
 */

interface PMNode {
  type: string;
  content?: PMNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

const BLOCK_TYPES = new Set(["paragraph", "heading", "listItem", "blockquote", "codeBlock"]);

function extractNodeText(node: PMNode): string {
  if (node.text) return node.text;
  if (!node.content) return "";
  return node.content.map(extractNodeText).join("");
}

/**
 * Extract plain text from a ProseMirror JSON document.
 * @param doc A ProseMirror document node (parsed from JSON string)
 * @returns Plain text with paragraphs separated by double newlines
 */
export function extractPlainTextFromJSON(doc: PMNode): string {
  if (!doc.content) return "";

  const blocks: string[] = [];

  function walk(node: PMNode) {
    if (BLOCK_TYPES.has(node.type)) {
      const text = extractNodeText(node).trim();
      if (text) blocks.push(text);
    } else if (node.content) {
      for (const child of node.content) {
        walk(child);
      }
    }
  }

  walk(doc);
  return blocks.join("\n\n");
}
