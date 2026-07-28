import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';
import { sanitizeMarkdownHtml } from '@/lib/sanitize';
import { 
  Bold, 
  Italic, 
  List, 
  ListOrdered, 
  Heading1,
  Heading2,
  Heading3,
  Undo,
  Redo,
  Quote
} from 'lucide-react';


interface RichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  placeholder?: string;
  className?: string;
  editorClassName?: string;
}

function MenuBar({ editor }: { editor: Editor | null }) {
  if (!editor) return null;

  // Prevent focus loss — use onMouseDown + preventDefault so editor selection is preserved
  const action = (cmd: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    cmd();
  };

  return (
    <div className="flex flex-wrap gap-1 p-1.5 border-b border-border bg-muted/30">
      <Toggle
        size="sm"
        pressed={editor.isActive('bold')}
        onPressedChange={() => {}}
        onMouseDown={action(() => editor.chain().focus().toggleBold().run())}
        aria-label="Bold"
        className="h-7 w-7 p-0"
      >
        <Bold className="h-3.5 w-3.5" />
      </Toggle>
      
      <Toggle
        size="sm"
        pressed={editor.isActive('italic')}
        onPressedChange={() => {}}
        onMouseDown={action(() => editor.chain().focus().toggleItalic().run())}
        aria-label="Italic"
        className="h-7 w-7 p-0"
      >
        <Italic className="h-3.5 w-3.5" />
      </Toggle>
      
      <Toggle
        size="sm"
        pressed={editor.isActive('heading', { level: 1 })}
        onPressedChange={() => {}}
        onMouseDown={action(() => editor.chain().focus().toggleHeading({ level: 1 }).run())}
        aria-label="Heading 1"
        className="h-7 w-7 p-0"
      >
        <Heading1 className="h-3.5 w-3.5" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive('heading', { level: 2 })}
        onPressedChange={() => {}}
        onMouseDown={action(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
        aria-label="Heading 2"
        className="h-7 w-7 p-0"
      >
        <Heading2 className="h-3.5 w-3.5" />
      </Toggle>

      <Toggle
        size="sm"
        pressed={editor.isActive('heading', { level: 3 })}
        onPressedChange={() => {}}
        onMouseDown={action(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
        aria-label="Heading 3"
        className="h-7 w-7 p-0"
      >
        <Heading3 className="h-3.5 w-3.5" />
      </Toggle>

      <div className="w-px h-5 bg-border mx-1 self-center" />
      
      <Toggle
        size="sm"
        pressed={editor.isActive('bulletList')}
        onPressedChange={() => {}}
        onMouseDown={action(() => editor.chain().focus().toggleBulletList().run())}
        aria-label="Bullet List"
        className="h-7 w-7 p-0"
      >
        <List className="h-3.5 w-3.5" />
      </Toggle>
      
      <Toggle
        size="sm"
        pressed={editor.isActive('orderedList')}
        onPressedChange={() => {}}
        onMouseDown={action(() => editor.chain().focus().toggleOrderedList().run())}
        aria-label="Numbered List"
        className="h-7 w-7 p-0"
      >
        <ListOrdered className="h-3.5 w-3.5" />
      </Toggle>
      
      <Toggle
        size="sm"
        pressed={editor.isActive('blockquote')}
        onPressedChange={() => {}}
        onMouseDown={action(() => editor.chain().focus().toggleBlockquote().run())}
        aria-label="Quote"
        className="h-7 w-7 p-0"
      >
        <Quote className="h-3.5 w-3.5" />
      </Toggle>

      <div className="w-px h-5 bg-border mx-1 self-center" />
      
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={() => {}}
        onMouseDown={action(() => editor.chain().focus().undo().run())}
        disabled={!editor.can().undo()}
        aria-label="Undo"
        className="h-7 w-7 p-0"
      >
        <Undo className="h-3.5 w-3.5" />
      </Toggle>
      
      <Toggle
        size="sm"
        pressed={false}
        onPressedChange={() => {}}
        onMouseDown={action(() => editor.chain().focus().redo().run())}
        disabled={!editor.can().redo()}
        aria-label="Redo"
        className="h-7 w-7 p-0"
      >
        <Redo className="h-3.5 w-3.5" />
      </Toggle>
    </div>
  );
}

export function RichTextEditor({ 
  content, 
  onChange, 
  placeholder = 'Write something...',
  className,
  editorClassName
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: 'is-editor-empty',
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class: cn(
          'tiptap-editor max-w-none focus:outline-none px-3 py-2',
          editorClassName
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  return (
    <div className={cn('rounded-md border border-input bg-background overflow-hidden flex flex-col', className)}>
      <MenuBar editor={editor} />
      <div className="overflow-y-auto h-[400px]">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export function RichTextDisplay({ content, className }: { content: string; className?: string }) {
  // Check if content looks like HTML
  const isHtml = content.startsWith('<') && content.includes('>');
  
  if (!isHtml) {
    // Render plain text with whitespace preserved
    return (
      <p className={cn('text-foreground whitespace-pre-wrap break-words', className)}>
        {content}
      </p>
    );
  }
  
  return (
    <div 
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none break-words',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className
      )}
      dangerouslySetInnerHTML={{ __html: sanitizeMarkdownHtml(content) }}
    />
  );
}
