import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { Plate, PlateContent, createPlatePlugin, useEditorRef, usePlateEditor } from 'platejs/react'
import { BasicMarksPlugin } from '@platejs/basic-nodes/react'
import { BasicBlocksPlugin, HighlightPlugin } from '@platejs/basic-nodes/react'
import { CodeBlockPlugin } from '@platejs/code-block/react'
import { ListPlugin } from '@platejs/list/react'
import { toggleList } from '@platejs/list'
import { MarkdownPlugin } from '@platejs/markdown'
import remarkGfm from 'remark-gfm'
import { useDocumentStore } from '../store/useDocumentStore'

type MenuPosition = {
  x: number
  y: number
}

const textColors = [
  { label: 'Default', value: '' },
  { label: 'Red', value: '#dc2626' },
  { label: 'Green', value: '#0f9f6e' },
  { label: 'Blue', value: '#2563eb' },
]

const highlightColors = [
  { label: 'Yellow', value: '#fef08a' },
  { label: 'Green', value: '#bbf7d0' },
  { label: 'Pink', value: '#fbcfe8' },
]

const TextColorPlugin = createPlatePlugin({
  key: 'textColor',
  node: {
    isLeaf: true,
    leafProps: ({ leaf }) => ({
      style: { color: (leaf as { textColor?: string }).textColor },
    }),
  },
})

const HighlightColorPlugin = createPlatePlugin({
  key: 'highlightColor',
  node: {
    isLeaf: true,
    leafProps: ({ leaf }) => ({
      style: {
        backgroundColor: (leaf as { highlightColor?: string }).highlightColor,
        borderRadius: 3,
        padding: '0 2px',
      },
    }),
  },
})

const plugins = [
  BasicMarksPlugin,
  BasicBlocksPlugin,
  HighlightPlugin,
  TextColorPlugin,
  HighlightColorPlugin,
  CodeBlockPlugin,
  ListPlugin,
  MarkdownPlugin.configure({
    options: { remarkPlugins: [remarkGfm] },
  }),
]

function getSelectionPosition(): MenuPosition | null {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const rect = range.getBoundingClientRect()
  const fallbackRect = range.getClientRects()[0]
  const targetRect = rect.width || rect.height ? rect : fallbackRect

  if (!targetRect) return null

  return {
    x: targetRect.left + targetRect.width / 2,
    y: targetRect.top,
  }
}

function isSelectionInsideEditor(): boolean {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return false

  const node = selection.anchorNode
  const element = node instanceof Element ? node : node?.parentElement
  return !!element?.closest('.plate-editor')
}

function isLeadingHyphenShortcut(): boolean {
  const selection = window.getSelection()
  if (!selection || !selection.isCollapsed || !isSelectionInsideEditor()) return false

  const anchorNode = selection.anchorNode
  if (!anchorNode || anchorNode.nodeType !== Node.TEXT_NODE) return false
  if (selection.anchorOffset !== 1 || anchorNode.textContent?.[0] !== '-') return false

  const parentElement = anchorNode.parentElement
  const blockElement = parentElement?.closest('[data-slate-node="element"]')
  if (!blockElement) return true

  const range = document.createRange()
  range.setStart(blockElement, 0)
  range.setEnd(anchorNode, selection.anchorOffset)
  return range.toString() === '-'
}

function BubbleButton({
  title,
  onMouseDown,
  children,
}: {
  title: string
  onMouseDown: (e: MouseEvent<HTMLButtonElement>) => void
  children: ReactNode
}) {
  return (
    <button
      className="bubble-menu-btn"
      title={title}
      onMouseDown={onMouseDown}
    >
      {children}
    </button>
  )
}

function EditorFloatingControls() {
  const editor = useEditorRef()
  const [selectionMenu, setSelectionMenu] = useState<MenuPosition | null>(null)
  const [slashMenu, setSlashMenu] = useState<MenuPosition | null>(null)

  const preventDefault = (fn: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    fn()
  }

  const updateSelectionMenu = useCallback(() => {
    const selection = window.getSelection()
    if (
      !selection ||
      selection.isCollapsed ||
      !selection.toString().trim() ||
      !isSelectionInsideEditor()
    ) {
      setSelectionMenu(null)
      return
    }

    setSelectionMenu(getSelectionPosition())
    setSlashMenu(null)
  }, [])

  useEffect(() => {
    document.addEventListener('selectionchange', updateSelectionMenu)
    window.addEventListener('resize', updateSelectionMenu)
    window.addEventListener('scroll', updateSelectionMenu, true)
    return () => {
      document.removeEventListener('selectionchange', updateSelectionMenu)
      window.removeEventListener('resize', updateSelectionMenu)
      window.removeEventListener('scroll', updateSelectionMenu, true)
    }
  }, [updateSelectionMenu])

  const openSlashMenu = () => {
    window.setTimeout(() => {
      const position = getSelectionPosition()
      if (position) {
        setSlashMenu({ x: position.x, y: position.y + 28 })
        setSelectionMenu(null)
      }
    }, 0)
  }

  const closeMenus = () => {
    setSelectionMenu(null)
    setSlashMenu(null)
  }

  const applyTextColor = (color: string) => {
    if (color) {
      editor.tf.addMark('textColor', color)
    } else {
      editor.tf.removeMarks('textColor')
    }
    closeMenus()
    editor.tf.focus()
  }

  const applyHighlight = (color: string) => {
    editor.tf.addMark('highlightColor', color)
    closeMenus()
    editor.tf.focus()
  }

  const removeSlashTrigger = () => {
    editor.tf.deleteBackward('character')
  }

  const runCommand = (command: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    removeSlashTrigger()
    command()
    closeMenus()
    editor.tf.focus()
  }

  return (
    <>
      {selectionMenu && (
        <div
          className="bubble-menu"
          style={{ '--bubble-x': `${selectionMenu.x}px`, '--bubble-y': `${selectionMenu.y}px` } as CSSProperties}
          onMouseDown={e => e.preventDefault()}
        >
          <BubbleButton title="Bold" onMouseDown={preventDefault(() => editor.tf.bold.toggle())}>
            <strong>B</strong>
          </BubbleButton>
          <BubbleButton title="Italic" onMouseDown={preventDefault(() => editor.tf.italic.toggle())}>
            <em>I</em>
          </BubbleButton>
          <BubbleButton title="Underline" onMouseDown={preventDefault(() => editor.tf.underline.toggle())}>
            <span className="bubble-underline">U</span>
          </BubbleButton>
          <span className="bubble-menu-divider" />
          <span className="bubble-menu-label">Text</span>
          {textColors.map(color => (
            <button
              key={color.label}
              className="bubble-swatch"
              title={color.label}
              style={{ '--swatch-color': color.value || 'var(--text-1)' } as CSSProperties}
              onMouseDown={preventDefault(() => applyTextColor(color.value))}
            />
          ))}
          <span className="bubble-menu-label">Fill</span>
          {highlightColors.map(color => (
            <button
              key={color.label}
              className="bubble-swatch highlight"
              title={`${color.label} highlight`}
              style={{ '--swatch-color': color.value } as CSSProperties}
              onMouseDown={preventDefault(() => applyHighlight(color.value))}
            />
          ))}
        </div>
      )}

      {slashMenu && (
        <div
          className="slash-menu"
          style={{ '--slash-x': `${slashMenu.x}px`, '--slash-y': `${slashMenu.y}px` } as CSSProperties}
          onMouseDown={e => e.preventDefault()}
        >
          <button className="slash-menu-item" onMouseDown={runCommand(() => editor.tf.h1.toggle())}>
            <span>H1</span>
            <strong>Heading 1</strong>
          </button>
          <button className="slash-menu-item" onMouseDown={runCommand(() => editor.tf.h2.toggle())}>
            <span>H2</span>
            <strong>Heading 2</strong>
          </button>
          <button className="slash-menu-item" onMouseDown={runCommand(() => toggleList(editor, { listStyleType: 'disc' }))}>
            <span>-</span>
            <strong>Bulleted list</strong>
          </button>
          <button className="slash-menu-item" onMouseDown={runCommand(() => toggleList(editor, { listStyleType: 'decimal' }))}>
            <span>1.</span>
            <strong>Numbered list</strong>
          </button>
          <button className="slash-menu-item" onMouseDown={runCommand(() => editor.tf.blockquote.toggle())}>
            <span>"</span>
            <strong>Quote</strong>
          </button>
          <button className="slash-menu-item" onMouseDown={runCommand(() => editor.tf.code_block.toggle())}>
            <span>{'{}'}</span>
            <strong>Code block</strong>
          </button>
          <button
            className="slash-menu-item"
            onMouseDown={runCommand(() => editor.tf.insertText('$$\n\n$$'))}
          >
            <span>Σ</span>
            <strong>LaTeX block</strong>
          </button>
        </div>
      )}

      <PlateContent
        className="plate-editor"
        spellCheck={false}
        placeholder="Start writing…"
        onKeyDown={e => {
          if (e.key === ' ' && isLeadingHyphenShortcut()) {
            e.preventDefault()
            closeMenus()
            editor.tf.deleteBackward('character')
            toggleList(editor, { listStyleType: 'disc' })
            return
          }
          if (e.key === '/') openSlashMenu()
          if (e.key === 'Escape') closeMenus()
        }}
      />
    </>
  )
}

export default function Editor() {
  const { content, setContent, saveDocument } = useDocumentStore()
  const [, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

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
        <div className="editor-body view-edit">
          <div className="editor-pane">
            <EditorFloatingControls />
          </div>
        </div>
      </Plate>
    </div>
  )
}
