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

const unsupportedVoidElementTypes = new Set([
  'hr',
  'thematicBreak',
  'thematic_break',
  'horizontalRule',
  'horizontal_rule',
])

function sanitizePlateNode(node: unknown): unknown | null {
  if (!node || typeof node !== 'object') return node

  if ('type' in node && typeof node.type === 'string' && unsupportedVoidElementTypes.has(node.type)) {
    return null
  }

  if (!('children' in node) || !Array.isArray(node.children)) return node

  const children = node.children
    .map(sanitizePlateNode)
    .filter((child): child is NonNullable<typeof child> => child !== null)

  return {
    ...node,
    children: children.length > 0 ? children : [{ text: '' }],
  }
}

function sanitizePlateDocument(value: PlateDocumentValue): PlateDocumentValue {
  const nodes = value
    .map(sanitizePlateNode)
    .filter((node): node is PlateDocumentValue[number] => node !== null)

  return nodes.length > 0 ? nodes : emptyPlateDocument()
}

export function clonePlateDocument(value: PlateDocumentValue): PlateDocumentValue {
  return sanitizePlateDocument(JSON.parse(JSON.stringify(value)) as PlateDocumentValue)
}

export function markdownToPlateDocument(markdown: string): PlateDocumentValue {
  if (!markdown.trim()) return emptyPlateDocument()

  try {
    const editor = createSlateEditor({ plugins: markdownPlugins })
    const value = editor.api.markdown.deserialize(markdown)
    return value.length > 0 ? sanitizePlateDocument(value) : emptyPlateDocument()
  } catch {
    return [{ type: 'p', children: [{ text: markdown }] }]
  }
}

export function plateDocumentToMarkdown(value: PlateDocumentValue): string {
  try {
    const editor = createSlateEditor({
      plugins: markdownPlugins,
      value: sanitizePlateDocument(clonePlateDocument(value)),
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
