/**
 * Document export utilities.
 * All run client-side — no backend dependency.
 */

import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import { saveAs } from "file-saver";

// ─── Plain Text ────────────────────────────────────────────────────────────

export function exportTxt(text: string, filename = "document.txt") {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  saveAs(blob, filename);
}

// ─── Markdown ──────────────────────────────────────────────────────────────

export function exportMarkdown(text: string, filename = "document.md") {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  saveAs(blob, filename);
}

// ─── HTML ──────────────────────────────────────────────────────────────────

export function exportHtml(html: string, title = "Document", filename = "document.html") {
  const full = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { max-width: 680px; margin: 2rem auto; padding: 0 1rem; font-family: Georgia, serif; line-height: 1.8; color: #1a1a1a; }
    h1, h2, h3 { font-family: system-ui, sans-serif; margin-top: 2rem; }
    blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1rem; color: #555; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; font-size: 0.9em; }
    @media print { body { max-width: none; margin: 0; } }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  const blob = new Blob([full], { type: "text/html;charset=utf-8" });
  saveAs(blob, filename);
}

// ─── DOCX ──────────────────────────────────────────────────────────────────

export async function exportDocx(text: string, title = "Document", filename = "document.docx") {
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim());

  const children = paragraphs.map((p) => {
    const trimmed = p.trim();

    if (trimmed.startsWith("# ")) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_1,
        children: [new TextRun({ text: trimmed.slice(2), bold: true })],
      });
    }
    if (trimmed.startsWith("## ")) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: trimmed.slice(3), bold: true })],
      });
    }
    if (trimmed.startsWith("### ")) {
      return new Paragraph({
        heading: HeadingLevel.HEADING_3,
        children: [new TextRun({ text: trimmed.slice(4), bold: true })],
      });
    }

    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      return new Paragraph({
        bullet: { level: 0 },
        children: [new TextRun({ text: trimmed.slice(2) })],
      });
    }

    return new Paragraph({
      children: [new TextRun({ text: trimmed })],
      spacing: { after: 200 },
    });
  });

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 },
          },
        },
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            alignment: AlignmentType.LEFT,
            children: [new TextRun({ text: title, bold: true })],
            spacing: { after: 400 },
          }),
          ...children,
        ],
      },
    ],
  });

  const buffer = await Packer.toBlob(doc);
  saveAs(buffer, filename);
}

// ─── PDF (via print) ───────────────────────────────────────────────────────

export function exportPdf(editorHtml: string, title = "Document") {
  // Build a self-contained HTML string, then open in a new window for printing.
  // The editorHtml is trusted output from the Tiptap editor (not external user input).
  const fullHtml = `<!DOCTYPE html><html><head>
    <title>${escapeHtml(title)}</title>
    <style>
      body { max-width: 680px; margin: 2rem auto; font-family: Georgia, serif; line-height: 1.8; color: #1a1a1a; }
      h1, h2, h3 { font-family: system-ui, sans-serif; }
      blockquote { border-left: 3px solid #ccc; margin-left: 0; padding-left: 1rem; color: #555; }
      @media print { body { max-width: none; margin: 1cm; } }
    </style>
  </head><body>${editorHtml}</body></html>`;

  const blob = new Blob([fullHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const printWindow = window.open(url, "_blank");
  if (!printWindow) {
    URL.revokeObjectURL(url);
    return;
  }
  printWindow.addEventListener("afterprint", () => URL.revokeObjectURL(url));
  printWindow.focus();
  setTimeout(() => printWindow.print(), 400);
}

// ─── Clipboard ─────────────────────────────────────────────────────────────

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
