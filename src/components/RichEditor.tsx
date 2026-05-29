import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { Bold, Italic, List, ListOrdered, Heading2, Heading3, Link as LinkIcon, Image as ImageIcon, Quote, Undo, Redo } from "lucide-react";
import { useEffect } from "react";

export function RichEditor({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({ HTMLAttributes: { class: "rounded-lg my-4 max-w-full" } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-primary underline" } }),
      Placeholder.configure({ placeholder: placeholder ?? "Rédigez le contenu…" }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose max-w-none min-h-[400px] p-4 focus:outline-none",
      },
    },
  });

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) return null;

  const Btn = ({ active, onClick, children, title }: any) => (
    <Button
      type="button"
      variant={active ? "default" : "ghost"}
      size="sm"
      onClick={onClick}
      title={title}
      className="h-8 px-2"
    >
      {children}
    </Button>
  );

  return (
    <div className="rounded-lg border bg-background">
      <div className="flex flex-wrap items-center gap-1 border-b p-2">
        <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} title="Gras"><Bold className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italique"><Italic className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Titre 2"><Heading2 className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Titre 3"><Heading3 className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Liste"><List className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Liste numérotée"><ListOrdered className="h-4 w-4" /></Btn>
        <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Citation"><Quote className="h-4 w-4" /></Btn>
        <Btn onClick={() => {
          const url = window.prompt("URL du lien");
          if (url) editor.chain().focus().setLink({ href: url }).run();
        }} title="Lien"><LinkIcon className="h-4 w-4" /></Btn>
        <Btn onClick={() => {
          const url = window.prompt("URL de l'image");
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }} title="Image"><ImageIcon className="h-4 w-4" /></Btn>
        <div className="ml-auto flex gap-1">
          <Btn onClick={() => editor.chain().focus().undo().run()} title="Annuler"><Undo className="h-4 w-4" /></Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} title="Refaire"><Redo className="h-4 w-4" /></Btn>
        </div>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}