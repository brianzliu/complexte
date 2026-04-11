import { useCallback, useRef, useState } from 'react'
import { Plate, PlateContent, usePlateEditor, useEditorRef, useEditorSelector } from 'platejs/react'
import { BasicMarksPlugin } from '@platejs/basic-nodes/react'
import { BasicBlocksPlugin } from '@platejs/basic-nodes/react'
import { ListPlugin, toggleList } from '@platejs/list/react'
import { MarkdownPlugin } from '@platejs/markdown'
import remarkGfm from 'remark-gfm'
import { useDocumentStore } from '../store/useDocumentStore'

const plugins = [
  BasicMarksPlugin,
  BasicBlocksPlugin,
  ListPlugin,
  MarkdownPlugin.configure({
    options: { remarkPlugins: [remarkGfm] },
  }),
]

function ToolbarButton({
  title,
  active,
  onMouseDown,
  children,
}: {
  title: string
  active?: boolean
  onMouseDown: (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
  return (
    <button
      className={`fmt-btn${active ? ' active' : ''}`}
      title={title}
      onMouseDown={onMouseDown}
    >
      {children}
    </button>
  )
}

function EditorToolbar({ saveState }: { saveState: 'idle' | 'saving' | 'saved' }) {
  const editor = useEditorRef()

  const isBold = useEditorSelector(e => !!(e.marks as Record<string, boolean>)?.bold, [])
  const isItalic = useEditorSelector(e => !!(e.marks as Record<string, boolean>)?.italic, [])
  const isUnderline = useEditorSelector(e => !!(e.marks as Record<string, boolean>)?.underline, [])
  const isCode = useEditorSelector(e => !!(e.marks as Record<string, boolean>)?.code, [])

  const preventDefault = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault()
    fn()
  }

  return (
    <div className="editor-toolbar">
      <div className="toolbar-formatting">
        <ToolbarButton
          title="Bold (⌘B)"
          active={isBold}
          onMouseDown={preventDefault(() => editor.tf.bold.toggle())}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
            <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          title="Italic (⌘I)"
          active={isItalic}
          onMouseDown={preventDefault(() => editor.tf.italic.toggle())}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="19" y1="4" x2="10" y2="4" />
            <line x1="14" y1="20" x2="5" y2="20" />
            <line x1="15" y1="4" x2="9" y2="20" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          title="Underline (⌘U)"
          active={isUnderline}
          onMouseDown={preventDefault(() => editor.tf.underline.toggle())}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 3v7a6 6 0 0 0 12 0V3" />
            <line x1="4" y1="21" x2="20" y2="21" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          title="Inline code"
          active={isCode}
          onMouseDown={preventDefault(() => editor.tf.code.toggle())}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="16 18 22 12 16 6" />
            <polyline points="8 6 2 12 8 18" />
          </svg>
        </ToolbarButton>

        <div className="toolbar-sep" />

        <ToolbarButton
          title="Heading 1"
          onMouseDown={preventDefault(() => editor.tf.h1.toggle())}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: -0.5 }}>H1</span>
        </ToolbarButton>

        <ToolbarButton
          title="Heading 2"
          onMouseDown={preventDefault(() => editor.tf.h2.toggle())}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, letterSpacing: -0.5 }}>H2</span>
        </ToolbarButton>

        <ToolbarButton
          title="Heading 3"
          onMouseDown={preventDefault(() => editor.tf.h3.toggle())}
        >
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: -0.5 }}>H3</span>
        </ToolbarButton>

        <div className="toolbar-sep" />

        <ToolbarButton
          title="Bullet list"
          onMouseDown={preventDefault(() => toggleList(editor, { listStyleType: 'disc' }))}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="9" y1="6" x2="20" y2="6" />
            <line x1="9" y1="12" x2="20" y2="12" />
            <line x1="9" y1="18" x2="20" y2="18" />
            <circle cx="4" cy="6" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="12" r="1.5" fill="currentColor" stroke="none" />
            <circle cx="4" cy="18" r="1.5" fill="currentColor" stroke="none" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          title="Numbered list"
          onMouseDown={preventDefault(() => toggleList(editor, { listStyleType: 'decimal' }))}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="10" y1="6" x2="21" y2="6" />
            <line x1="10" y1="12" x2="21" y2="12" />
            <line x1="10" y1="18" x2="21" y2="18" />
            <path d="M4 6h1v4" />
            <path d="M4 10h2" />
            <path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1" />
          </svg>
        </ToolbarButton>

        <ToolbarButton
          title="Blockquote"
          onMouseDown={preventDefault(() => editor.tf.blockquote.toggle())}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
            <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
          </svg>
        </ToolbarButton>
      </div>

      <div className="toolbar-center" />

      <div className="toolbar-view-modes">
        {saveState === 'saving' && (
          <span className="save-label">
            <span className="save-dot spinning" />
            Saving
          </span>
        )}
        {saveState === 'saved' && (
          <span className="save-label">
            <span className="save-dot saved" />
            Saved
          </span>
        )}
      </div>
    </div>
  )
}

export default function Editor() {
  const { content, setContent, saveDocument } = useDocumentStore()
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>()

  const editor = usePlateEditor({
    plugins,
    value: (e) => {
      if (content) {
        try {
          return e.api.markdown.deserialize(content)
        } catch {
          // fall through to default
        }
      }
      return [{ type: 'p', children: [{ text: '' }] }]
    },
  })

  const handleValueChange = useCallback(() => {
    try {
      const markdown = editor.api.markdown.serialize()
      setContent(markdown)

      clearTimeout(saveTimerRef.current)
      clearTimeout(savedTimerRef.current)
      setSaveState('saving')

      saveTimerRef.current = setTimeout(() => {
        saveDocument()
        setSaveState('saved')
        savedTimerRef.current = setTimeout(() => setSaveState('idle'), 1800)
      }, 1200)
    } catch {
      // ignore serialization errors
    }
  }, [editor, setContent, saveDocument])

  return (
    <div className="editor-root">
      <Plate editor={editor} onValueChange={handleValueChange}>
        <EditorToolbar saveState={saveState} />
        <div className="editor-body view-edit">
          <div className="editor-pane">
            <PlateContent
              className="plate-editor"
              spellCheck={false}
              placeholder="Start writing…"
            />
          </div>
        </div>
      </Plate>

      <div className="editor-statusbar">
        <span className="status-pill status-badge">Rich Text</span>
        <div className="status-spacer" />
        <span className="status-pill mode-pill">Plate Editor</span>
      </div>
    </div>
  )
}
