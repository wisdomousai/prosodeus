/**
 * Extract plain text from a ProseMirror JSON document.
 * Block-level nodes (paragraphs, headings, list items) are joined with \n\n.
 * This produces output compatible with the existing splitAndHash() pipeline.
 */

interface PMNode {
  type: string;
  content?: PMNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

const BLOCK_TYPES = new Set([
  "paragraph",
  "heading",
  "listItem",
  "blockquote",
  "codeBlock",
  "horizontalRule",
]);

function extractNodeText(node: PMNode): string {
  if (node.text) return node.text;
  if (!node.content) return "";
  return node.content.map(extractNodeText).join("");
}

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
