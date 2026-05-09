import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent, ReactNode } from 'react'
import { Plate, PlateContent, createPlatePlugin, useEditorRef, usePlateEditor } from 'platejs/react'
import { BasicMarksPlugin } from '@platejs/basic-nodes/react'
import { BasicBlocksPlugin, HighlightPlugin } from '@platejs/basic-nodes/react'
import { AutoformatPlugin, autoformatArrow, autoformatMath, autoformatPunctuation } from '@platejs/autoformat'
import { CodeBlockPlugin } from '@platejs/code-block/react'
import { ListPlugin } from '@platejs/list/react'
import { toggleList } from '@platejs/list'
import { MarkdownPlugin } from '@platejs/markdown'
import remarkGfm from 'remark-gfm'
import { clonePlateDocument, plateDocumentToPlainText, type PlateDocumentValue } from '../lib/plateDocument'
import { reviseSelection } from '../lib/openRouter'
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
  AutoformatPlugin.configure({
    options: {
      rules: [
        { mode: 'block', type: 'h1', match: '# ' },
        { mode: 'block', type: 'h2', match: '## ' },
        { mode: 'block', type: 'h3', match: '### ' },
        { mode: 'block', type: 'blockquote', match: '> ' },
        {
          mode: 'block',
          match: '- ',
          format: editor => toggleList(editor, { listStyleType: 'disc' }),
        },
        {
          mode: 'block',
          match: '1\\. ',
          matchByRegex: true,
          format: editor => toggleList(editor, { listStyleType: 'decimal' }),
        },
        { mode: 'mark', type: 'bold', match: '**' },
        { mode: 'mark', type: 'italic', match: '*' },
        { mode: 'mark', type: 'code', match: '`' },
        ...autoformatArrow,
        ...autoformatPunctuation,
        ...autoformatMath,
      ],
    },
  }),
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

function hasActiveSlashTrigger(): boolean {
  const selection = window.getSelection()
  if (!selection || !selection.isCollapsed || !isSelectionInsideEditor()) return false

  const anchorNode = selection.anchorNode
  if (!anchorNode) return false

  const anchorElement = anchorNode instanceof Element ? anchorNode : anchorNode.parentElement
  const blockElement = anchorElement?.closest('[data-slate-node="element"]')
  if (!blockElement) return false

  const range = document.createRange()
  range.setStart(blockElement, 0)
  range.setEnd(anchorNode, selection.anchorOffset)

  return /(?:^|\s)\/\S*$/.test(range.toString())
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
  const { activeId, addSelectionAiAction, aiSettings, content, pages } = useDocumentStore()
  const [selectionMenu, setSelectionMenu] = useState<MenuPosition | null>(null)
  const [slashMenu, setSlashMenu] = useState<MenuPosition | null>(null)
  const [applyMode, setApplyMode] = useState<'replace' | 'insert-below' | 'suggestion'>('replace')
  const [aiPrompt, setAiPrompt] = useState('')
  const [aiError, setAiError] = useState<string | null>(null)
  const [isRevisingSelection, setIsRevisingSelection] = useState(false)
  const [isBubbleInteracting, setIsBubbleInteracting] = useState(false)
  const isPointerSelectingRef = useRef(false)
  const selectionRangeRef = useRef<Range | null>(null)
  const selectionTextRef = useRef('')

  const preventDefault = (fn: () => void) => (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    fn()
  }

  const updateSelectionMenu = useCallback(() => {
    if (isPointerSelectingRef.current || isBubbleInteracting) return

    const selection = window.getSelection()
    if (
      !selection ||
      selection.isCollapsed ||
      !selection.toString().trim() ||
      !isSelectionInsideEditor()
    ) {
      setSelectionMenu(null)
      selectionRangeRef.current = null
      selectionTextRef.current = ''
      return
    }

    selectionRangeRef.current = selection.getRangeAt(0).cloneRange()
    selectionTextRef.current = selection.toString().trim()
    setSelectionMenu(getSelectionPosition())
    setAiError(null)
    setSlashMenu(null)
  }, [isBubbleInteracting])

  const closeMenus = useCallback(() => {
    setSelectionMenu(null)
    setSlashMenu(null)
    setApplyMode('replace')
    setAiPrompt('')
    setAiError(null)
    setIsBubbleInteracting(false)
    selectionRangeRef.current = null
    selectionTextRef.current = ''
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

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target
      const targetElement = target instanceof Element
        ? target
        : target instanceof Node
          ? target.parentElement
          : null
      if (!targetElement) return
      if (targetElement.closest('.bubble-menu, .slash-menu')) return

      isPointerSelectingRef.current = !!targetElement.closest('.plate-editor')
      closeMenus()

      if (!isPointerSelectingRef.current) {
        window.getSelection()?.removeAllRanges()
      }
    }

    const handlePointerUp = () => {
      if (!isPointerSelectingRef.current) return

      isPointerSelectingRef.current = false
      window.setTimeout(updateSelectionMenu, 0)
    }

    document.addEventListener('pointerdown', handlePointerDown, true)
    document.addEventListener('pointerup', handlePointerUp, true)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown, true)
      document.removeEventListener('pointerup', handlePointerUp, true)
    }
  }, [closeMenus, updateSelectionMenu])

  const replaceSelectedText = useCallback((nextText: string) => {
    const range = selectionRangeRef.current
    const selection = window.getSelection()
    if (!range || !selection) return false

    selection.removeAllRanges()
    selection.addRange(range)

    const inserted = document.execCommand('insertText', false, nextText)
    if (inserted) return true

    range.deleteContents()
    const textNode = document.createTextNode(nextText)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    return true
  }, [])

  const insertBelowSelection = useCallback((nextText: string) => {
    const range = selectionRangeRef.current
    const selection = window.getSelection()
    if (!range || !selection) return false

    selection.removeAllRanges()
    selection.addRange(range)
    range.collapse(false)

    const inserted = document.execCommand('insertText', false, `\n${nextText}`)
    if (inserted) return true

    const textNode = document.createTextNode(`\n${nextText}`)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
    return true
  }, [])

  const insertSuggestionBelowSelection = useCallback((nextText: string) => {
    const suggestionText = `Suggestion:\n${nextText}`
    return insertBelowSelection(suggestionText)
  }, [insertBelowSelection])

  const handleAiSubmit = async () => {
    if (!aiSettings.openRouterApiKey.trim()) {
      setAiError('Add your OpenRouter key in Settings first.')
      return
    }

    if (!aiPrompt.trim()) {
      setAiError('Describe how you want the selection revised.')
      return
    }

    if (!selectionTextRef.current || !selectionRangeRef.current) {
      setAiError('Select some text before asking the AI to revise it.')
      return
    }

    setAiError(null)
    setIsRevisingSelection(true)

    try {
      const result = await reviseSelection({
        apiKey: aiSettings.openRouterApiKey,
        model: aiSettings.openRouterModel,
        instruction: aiPrompt,
        selection: selectionTextRef.current,
        documentContext: plateDocumentToPlainText(content),
      })

      const applied = applyMode === 'replace'
        ? replaceSelectedText(result)
        : applyMode === 'insert-below'
          ? insertBelowSelection(result)
          : insertSuggestionBelowSelection(result)

      if (!applied) {
        throw new Error('Could not apply the revision to the selected text.')
      }

      const activePage = activeId ? pages.find(page => page.id === activeId) : null
      if (activePage) {
        addSelectionAiAction({
          workspaceId: activePage.workspaceId,
          pageId: activePage.id,
          instruction: aiPrompt,
          selectionPreview: selectionTextRef.current.slice(0, 160),
          applyMode,
        })
      }

      closeMenus()
      editor.tf.focus()
    } catch (error) {
      setAiError(error instanceof Error ? error.message : 'Could not revise the selected text.')
    } finally {
      setIsRevisingSelection(false)
    }
  }

  const openSlashMenu = () => {
    window.setTimeout(() => {
      if (!hasActiveSlashTrigger()) {
        setSlashMenu(null)
        return
      }

      const position = getSelectionPosition()
      if (position) {
        setSlashMenu({ x: position.x, y: position.y + 28 })
        setSelectionMenu(null)
      }
    }, 0)
  }

  const syncSlashMenu = () => {
    window.setTimeout(() => {
      if (!hasActiveSlashTrigger()) {
        setSlashMenu(null)
      }
    }, 0)
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
        >
          <form
            className="bubble-ai-form"
            onSubmit={event => {
              event.preventDefault()
              void handleAiSubmit()
            }}
            onMouseDown={() => setIsBubbleInteracting(true)}
          >
            <div className="bubble-ai-mode-row">
              <button
                type="button"
                className={`bubble-ai-mode-btn ${applyMode === 'replace' ? 'active' : ''}`}
                onClick={() => setApplyMode('replace')}
              >
                Replace
              </button>
              <button
                type="button"
                className={`bubble-ai-mode-btn ${applyMode === 'insert-below' ? 'active' : ''}`}
                onClick={() => setApplyMode('insert-below')}
              >
                Insert below
              </button>
              <button
                type="button"
                className={`bubble-ai-mode-btn ${applyMode === 'suggestion' ? 'active' : ''}`}
                onClick={() => setApplyMode('suggestion')}
              >
                Suggest below
              </button>
            </div>
            <div className="bubble-ai-input-row">
              <input
                className="bubble-ai-input"
                type="text"
                value={aiPrompt}
                onChange={event => setAiPrompt(event.target.value)}
                placeholder="Ask AI how to revise this selection..."
                disabled={isRevisingSelection}
              />
              <button
                type="submit"
                className="bubble-ai-submit"
                disabled={isRevisingSelection}
              >
                {isRevisingSelection ? '...' : 'Ask'}
              </button>
            </div>
          </form>

          {aiError && <p className="bubble-ai-error">{aiError}</p>}

          <div className="bubble-menu-row">
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
          if (e.key === '/') openSlashMenu()
          if (e.key === 'Escape') closeMenus()
        }}
        onKeyUp={syncSlashMenu}
      />
    </>
  )
}

export default function Editor() {
  const { activeId, content, contentVersion, pages, setContent, saveDocument } = useDocumentStore()
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')

  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const isApplyingExternalContentRef = useRef(false)
  const syncedContentVersionRef = useRef(contentVersion)

  const editor = usePlateEditor({
    plugins,
    value: () => clonePlateDocument(content),
  })

  const handleValueChange = useCallback(() => {
    if (isApplyingExternalContentRef.current) return

    try {
      setContent(clonePlateDocument(editor.children as PlateDocumentValue))

      clearTimeout(saveTimerRef.current)
      clearTimeout(savedTimerRef.current)
      setSaveState('saving')

      saveTimerRef.current = setTimeout(() => {
        saveDocument()
        setSaveState('saved')
        savedTimerRef.current = setTimeout(() => setSaveState('idle'), 1800)
      }, 1200)
    } catch {
      // Ignore transient editor state while Plate is normalizing nodes.
    }
  }, [editor, setContent, saveDocument])

  useEffect(() => {
    if (syncedContentVersionRef.current === contentVersion) return

    syncedContentVersionRef.current = contentVersion
    isApplyingExternalContentRef.current = true
    editor.tf.replaceNodes(clonePlateDocument(content) as never, { at: [], children: true })
    window.setTimeout(() => {
      isApplyingExternalContentRef.current = false
    }, 0)
  }, [content, contentVersion, editor])

  const activePage = useMemo(
    () => (activeId ? pages.find(page => page.id === activeId) ?? null : null),
    [activeId, pages],
  )
  const plainText = useMemo(() => plateDocumentToPlainText(content).trim(), [content])
  const wordCount = useMemo(
    () => (plainText ? plainText.split(/\s+/).filter(Boolean).length : 0),
    [plainText],
  )
  const characterCount = plainText.length
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 220))
  const confidenceLabel = activePage
    ? activePage.organizationConfidence >= 0.75
      ? 'Placement stable'
      : activePage.organizationConfidence >= 0.45
        ? 'Placement under review'
        : 'Placement uncertain'
    : 'Writing'

  return (
    <div className="editor-root">
      <Plate editor={editor} onValueChange={handleValueChange}>
        <div className="editor-body view-edit">
          <div className="editor-pane">
            <EditorFloatingControls />
          </div>
        </div>
      </Plate>
      <div className="editor-statusbar">
        <div className={`save-label ${saveState}`}>
          <span className={`save-dot ${saveState === 'saving' ? 'spinning' : saveState === 'saved' ? 'saved' : ''}`} />
          <span>
            {saveState === 'saving'
              ? 'Autosaving'
              : saveState === 'saved'
                ? 'Saved just now'
                : 'Live editing'}
          </span>
        </div>
        <span className="status-dot-sep" />
        <span className="status-pill">{wordCount} words</span>
        <span className="status-dot-sep" />
        <span className="status-pill">{characterCount} chars</span>
        <span className="status-dot-sep" />
        <span className="status-pill">{readingMinutes} min read</span>
        <span className="status-spacer" />
        {activePage?.collections[0] && (
          <span className="mode-pill">{activePage.collections[0]}</span>
        )}
        <span className={`mode-pill ${activePage?.organizationConfidence && activePage.organizationConfidence < 0.45 ? 'warning' : ''}`}>
          {confidenceLabel}
        </span>
        <span className="mode-pill">Highlight to ask AI</span>
      </div>
    </div>
  )
}
