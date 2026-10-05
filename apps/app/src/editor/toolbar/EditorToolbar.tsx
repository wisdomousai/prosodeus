import type { Editor } from "@tiptap/react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Underline as UnderlineIcon,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface Props {
  editor: Editor | null;
}

export function EditorToolbar({ editor }: Props) {
  if (!editor) return null;

  const btn = (active: boolean, onClick: () => void, icon: React.ReactNode, title: string) => (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={`h-8 w-8 shrink-0 rounded-md p-0 ${active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
      onClick={onClick}
      title={title}
    >
      {icon}
    </Button>
  );

  return (
    <div
      data-editor-toolbar
      className="flex min-w-0 items-center gap-1 overflow-x-auto border-b border-border bg-card px-3 py-1.5 md:px-5"
    >
      {btn(
        editor.isActive("bold"),
        () => editor.chain().focus().toggleBold().run(),
        <Bold className="size-3.5" />,
        "Bold",
      )}
      {btn(
        editor.isActive("italic"),
        () => editor.chain().focus().toggleItalic().run(),
        <Italic className="size-3.5" />,
        "Italic",
      )}
      {btn(
        editor.isActive("underline"),
        () => editor.chain().focus().toggleUnderline().run(),
        <UnderlineIcon className="size-3.5" />,
        "Underline",
      )}
      {btn(
        editor.isActive("code"),
        () => editor.chain().focus().toggleCode().run(),
        <Code className="size-3.5" />,
        "Code",
      )}

      <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />

      {btn(
        editor.isActive("heading", { level: 1 }),
        () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
        <Heading1 className="size-3.5" />,
        "Heading 1",
      )}
      {btn(
        editor.isActive("heading", { level: 2 }),
        () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
        <Heading2 className="size-3.5" />,
        "Heading 2",
      )}
      {btn(
        editor.isActive("heading", { level: 3 }),
        () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
        <Heading3 className="size-3.5" />,
        "Heading 3",
      )}

      <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />

      {btn(
        editor.isActive("bulletList"),
        () => editor.chain().focus().toggleBulletList().run(),
        <List className="size-3.5" />,
        "Bullet List",
      )}
      {btn(
        editor.isActive("orderedList"),
        () => editor.chain().focus().toggleOrderedList().run(),
        <ListOrdered className="size-3.5" />,
        "Ordered List",
      )}
      {btn(
        editor.isActive("blockquote"),
        () => editor.chain().focus().toggleBlockquote().run(),
        <Quote className="size-3.5" />,
        "Blockquote",
      )}

      <Separator orientation="vertical" className="h-4 mx-1 shrink-0" />

      {btn(
        false,
        () => editor.chain().focus().undo().run(),
        <Undo2 className="size-3.5" />,
        "Undo",
      )}
      {btn(
        false,
        () => editor.chain().focus().redo().run(),
        <Redo2 className="size-3.5" />,
        "Redo",
      )}
    </div>
  );
}
