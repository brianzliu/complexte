import type { Value } from 'platejs'
import { createSlateEditor } from 'platejs'
import { MarkdownPlugin } from '@platejs/markdown'
import remarkGfm from 'remark-gfm'

export type PlateDocumentValue = Value

export const emptyPlateDocument = (): PlateDocumentValue => [
  { type: 'p', children: [{ text: '' }] },
]

const markdownPlugins = [
  MarkdownPlugin.configure({
    options: { remarkPlugins: [remarkGfm] },
  }),
]

export function clonePlateDocument(value: PlateDocumentValue): PlateDocumentValue {
  return JSON.parse(JSON.stringify(value)) as PlateDocumentValue
}

export function markdownToPlateDocument(markdown: string): PlateDocumentValue {
  if (!markdown.trim()) return emptyPlateDocument()

  try {
    const editor = createSlateEditor({ plugins: markdownPlugins })
    const value = editor.api.markdown.deserialize(markdown)
    return value.length > 0 ? value : emptyPlateDocument()
  } catch {
    return [{ type: 'p', children: [{ text: markdown }] }]
  }
}

export function plateDocumentToMarkdown(value: PlateDocumentValue): string {
  try {
    const editor = createSlateEditor({
      plugins: markdownPlugins,
      value: clonePlateDocument(value),
    })
    return editor.api.markdown.serialize()
  } catch {
    return plateDocumentToPlainText(value)
  }
}

export function plateDocumentToPlainText(value: PlateDocumentValue): string {
  const lines: string[] = []

  const visit = (node: unknown): string => {
    if (!node || typeof node !== 'object') return ''

    if ('text' in node && typeof node.text === 'string') {
      return node.text
    }

    if ('children' in node && Array.isArray(node.children)) {
      return node.children.map(visit).join('')
    }

    return ''
  }

  value.forEach(node => {
    const text = visit(node)
    if (text.trim()) lines.push(text)
  })

  return lines.join('\n')
}
