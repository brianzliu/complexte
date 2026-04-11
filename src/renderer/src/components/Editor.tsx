import { useState, useEffect, useRef, useCallback } from 'react'
import { marked } from 'marked'
import { useDocumentStore } from '../store/useDocumentStore'

type ViewMode = 'edit' | 'split' | 'preview'

marked.setOptions({ gfm: true, breaks: true })

export default function Editor() {
  const { content, setContent, saveDocument } = useDocumentStore()
  const [viewMode, setViewMode] = useState<ViewMode>('split')
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [renderedHtml, setRenderedHtml] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>()
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>()

  // Render markdown
  useEffect(() => {
    const result = marked.parse(content)
    if (typeof result === 'string') {
      setRenderedHtml(result)
    } else {
      result.then(setRenderedHtml)
    }
  }, [content])

  // Auto-save with debounce
  useEffect(() => {
    clearTimeout(saveTimerRef.current)
    clearTimeout(savedTimerRef.current)

    saveTimerRef.current = setTimeout(() => {
      setSaveState('saving')
      saveDocument()
      savedTimerRef.current = setTimeout(() => setSaveState('saved'), 600)
      setTimeout(() => setSaveState('idle'), 2400)
    }, 1200)

    return () => {
      clearTimeout(saveTimerRef.current)
      clearTimeout(savedTimerRef.current)
    }
  }, [content])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      const ta = e.currentTarget

      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        saveDocument()
        setSaveState('saved')
        savedTimerRef.current = setTimeout(() => setSaveState('idle'), 1800)
        return
      }

      if (e.key === 'Tab') {
        e.preventDefault()
        const start = ta.selectionStart
        const end = ta.selectionEnd
        const next = content.slice(0, start) + '  ' + content.slice(end)
        setContent(next)
        setTimeout(() => {
          ta.selectionStart = ta.selectionEnd = start + 2
        }, 0)
        return
      }

      // Continue list on Enter
      if (e.key === 'Enter') {
        const start = ta.selectionStart
        const lineStart = content.lastIndexOf('\n', start - 1) + 1
        const currentLine = content.slice(lineStart, start)
        const listMatch = currentLine.match(/^(\s*)([-*+]|\d+\.)\s/)
        if (listMatch) {
          e.preventDefault()
          const [full, indent, bullet] = listMatch
          const isOrdered = /^\d+\./.test(bullet)
          const nextBullet = isOrdered
            ? `${parseInt(bullet) + 1}.`
            : bullet
          const insert = `\n${indent}${nextBullet} `
          const next = content.slice(0, start) + insert + content.slice(start)
          setContent(next)
          setTimeout(() => {
            ta.selectionStart = ta.selectionEnd = start + insert.length
          }, 0)
        }
      }
    },
    [content, setContent, saveDocument],
  )

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0
  const lineCount = content.split('\n').length

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    const ta = textareaRef.current
    if (!ta) return
    const start = ta.selectionStart
    const end = ta.selectionEnd
    const selected = content.slice(start, end)
    const inserted = prefix + (selected || 'text') + suffix
    const next = content.slice(0, start) + inserted + content.slice(end)
    setContent(next)
    setTimeout(() => {
      ta.focus()
      if (selected) {
        ta.selectionStart = start + prefix.length
        ta.selectionEnd = start + prefix.length + selected.length
      } else {
        ta.selectionStart = start + prefix.length
        ta.selectionEnd = start + prefix.length + 4
      }
    }, 0)
  }

  return (
    <div className="editor-root">
      {/* ── Toolbar ── */}
      <div className="editor-toolbar">
        <div className="toolbar-formatting">
          <button className="fmt-btn" title="Bold (⌘B)" onClick={() => insertMarkdown('**', '**')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
              <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
            </svg>
          </button>
          <button className="fmt-btn" title="Italic (⌘I)" onClick={() => insertMarkdown('*', '*')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="19" y1="4" x2="10" y2="4" />
              <line x1="14" y1="20" x2="5" y2="20" />
              <line x1="15" y1="4" x2="9" y2="20" />
            </svg>
          </button>
          <button className="fmt-btn" title="Inline code" onClick={() => insertMarkdown('`', '`')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="16 18 22 12 16 6" />
              <polyline points="8 6 2 12 8 18" />
            </svg>
          </button>
          <div className="toolbar-sep" />
          <button className="fmt-btn" title="Heading 1" onClick={() => insertMarkdown('# ')}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: -0.5 }}>H1</span>
          </button>
          <button className="fmt-btn" title="Heading 2" onClick={() => insertMarkdown('## ')}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, letterSpacing: -0.5 }}>H2</span>
          </button>
          <div className="toolbar-sep" />
          <button className="fmt-btn" title="Bullet list" onClick={() => insertMarkdown('- ')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="9" y1="6" x2="20" y2="6" />
              <line x1="9" y1="12" x2="20" y2="12" />
              <line x1="9" y1="18" x2="20" y2="18" />
              <circle cx="4" cy="6" r="1.5" fill="currentColor" />
              <circle cx="4" cy="12" r="1.5" fill="currentColor" />
              <circle cx="4" cy="18" r="1.5" fill="currentColor" />
            </svg>
          </button>
          <button className="fmt-btn" title="Blockquote" onClick={() => insertMarkdown('> ')}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z" />
              <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z" />
            </svg>
          </button>
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

          <div className="view-toggle-group">
            <button
              className={`view-toggle-btn ${viewMode === 'edit' ? 'active' : ''}`}
              onClick={() => setViewMode('edit')}
            >
              Edit
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'split' ? 'active' : ''}`}
              onClick={() => setViewMode('split')}
            >
              Split
            </button>
            <button
              className={`view-toggle-btn ${viewMode === 'preview' ? 'active' : ''}`}
              onClick={() => setViewMode('preview')}
            >
              Preview
            </button>
          </div>
        </div>
      </div>

      {/* ── Editor Body ── */}
      <div className={`editor-body view-${viewMode}`}>
        {viewMode !== 'preview' && (
          <div className="editor-pane">
            <textarea
              ref={textareaRef}
              className="editor-textarea"
              value={content}
              onChange={e => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              placeholder="Start writing…"
            />
          </div>
        )}

        {viewMode === 'split' && <div className="editor-divider" />}

        {viewMode !== 'edit' && (
          <div className="preview-pane">
            <div
              className="prose"
              dangerouslySetInnerHTML={{ __html: renderedHtml }}
            />
          </div>
        )}
      </div>

      {/* ── Status Bar ── */}
      <div className="editor-statusbar">
        <span className="status-pill">{wordCount} words</span>
        <span className="status-dot-sep" />
        <span className="status-pill">{lineCount} lines</span>
        <div className="status-spacer" />
        <span className="status-pill mode-pill">Markdown</span>
      </div>
    </div>
  )
}
