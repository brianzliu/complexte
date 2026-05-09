type WorkspaceDocument = {
  id: string
  name: string
  indexedPath: string[]
  content: string
  semanticVector?: number[]
}

type DocumentLinkType = 'supports' | 'extends' | 'related_to' | 'derived_from'

export type InferredDocumentLink = {
  targetId: string
  type: DocumentLinkType
}

type CollectionCandidate = {
  label: string
  path: string[]
  keywords: string[]
}

type RelatedDocument = WorkspaceDocument & {
  score: number
}

export type OrganizationSuggestion = {
  label: string
  indexedPath: string[]
  score: number
}

export type RetrievedChunk = {
  id: string
  documentId: string
  documentName: string
  indexedPath: string[]
  content: string
  excerpt: string
  score: number
}

type OrganizationResult = {
  indexedPath: string[]
  collections: string[]
  relatedIds: string[]
  relatedLinks: InferredDocumentLink[]
  confidence: number
  suggestions: OrganizationSuggestion[]
}

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'how', 'i',
  'in', 'is', 'it', 'of', 'on', 'or', 'that', 'the', 'this', 'to', 'was', 'we',
  'with', 'you', 'your',
])

const COLLECTION_CANDIDATES: CollectionCandidate[] = [
  {
    label: 'Projects',
    path: ['Projects', 'Roadmap'],
    keywords: ['project', 'roadmap', 'milestone', 'timeline', 'launch', 'planning', 'quarter', 'q1', 'q2', 'q3', 'q4'],
  },
  {
    label: 'Design',
    path: ['Projects', 'Design'],
    keywords: ['design', 'interface', 'layout', 'typography', 'aesthetic', 'visual', 'prototype', 'ux', 'ui'],
  },
  {
    label: 'Meetings',
    path: ['Work', 'Meetings'],
    keywords: ['meeting', 'agenda', 'attendees', 'notes', 'review', 'standup', 'action', 'decisions'],
  },
  {
    label: 'Research',
    path: ['Research'],
    keywords: ['research', 'study', 'paper', 'source', 'question', 'hypothesis', 'findings', 'references'],
  },
  {
    label: 'Writing',
    path: ['Writing', 'Drafts'],
    keywords: ['draft', 'outline', 'essay', 'article', 'post', 'chapter', 'manuscript', 'writing'],
  },
  {
    label: 'Classes',
    path: ['Classes', 'Math', 'Notes'],
    keywords: ['class', 'course', 'lecture', 'calculus', 'integral', 'derivative', 'algebra', 'geometry', 'assignment', 'problem'],
  },
]

const VECTOR_DIMENSIONS = 96

export function tokenize(value: string): string[] {
  return (value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])
    .filter(token => !STOP_WORDS.has(token))
}

function hashToken(token: string): number {
  let hash = 2166136261
  for (let index = 0; index < token.length; index += 1) {
    hash ^= token.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0)
}

function normalizeVector(vector: number[]): number[] {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
  if (!magnitude) return vector
  return vector.map(value => value / magnitude)
}

export function buildSemanticVector(title: string, body: string, collections: string[] = []): number[] {
  const vector = new Array<number>(VECTOR_DIMENSIONS).fill(0)
  const weightedTokens = [
    ...tokenize(title).map(token => ({ token, weight: 3 })),
    ...tokenize(body).map(token => ({ token, weight: 1 })),
    ...collections.flatMap(collection => tokenize(collection).map(token => ({ token, weight: 2 }))),
  ]

  weightedTokens.forEach(({ token, weight }) => {
    const hash = hashToken(token)
    const index = hash % VECTOR_DIMENSIONS
    const sign = hash % 2 === 0 ? 1 : -1
    vector[index] += weight * sign
  })

  return normalizeVector(vector)
}

function cosineSimilarity(left: number[], right: number[]): number {
  if (left.length === 0 || right.length === 0) return 0
  const length = Math.min(left.length, right.length)
  let dot = 0
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index]
  }
  return Math.max(0, dot)
}

export function scoreDocumentSimilarity(
  queryText: string,
  title: string,
  body: string,
  collections: string[] = [],
  precomputedVector?: number[],
): number {
  const promptTokens = tokenize(queryText)
  if (promptTokens.length === 0) return 0

  const queryVector = buildSemanticVector(queryText, queryText)
  const documentVector = precomputedVector && precomputedVector.length > 0
    ? precomputedVector
    : buildSemanticVector(title, body, collections)
  const titleTokens = tokenize(title)
  const titleTokenSet = new Set(titleTokens)
  let score = 0
  promptTokens.forEach(token => {
    if (titleTokenSet.has(token)) score += 4
  })

  return cosineSimilarity(queryVector, documentVector) + (score / Math.sqrt(titleTokens.length + 1)) * 0.08
}

function scoreCollectionFit(title: string, body: string, candidate: CollectionCandidate): number {
  const candidateVector = buildSemanticVector(candidate.label, candidate.keywords.join(' '))
  const documentVector = buildSemanticVector(title, body)
  return cosineSimilarity(candidateVector, documentVector) * 10
}

function hasAnyKeyword(value: string, keywords: string[]): boolean {
  return keywords.some(keyword => value.includes(keyword))
}

function inferLinkType(source: WorkspaceDocument, target: WorkspaceDocument): DocumentLinkType {
  const sourceText = `${source.name}\n${source.content}`.toLowerCase()
  const targetText = `${target.name}\n${target.content}`.toLowerCase()

  if (
    hasAnyKeyword(sourceText, ['draft', 'outline', 'proposal', 'brief', 'essay', 'article'])
    && hasAnyKeyword(targetText, ['research', 'notes', 'meeting', 'findings', 'reference', 'source'])
  ) {
    return 'derived_from'
  }

  if (
    hasAnyKeyword(sourceText, ['meeting', 'notes', 'research', 'findings', 'reference', 'decision'])
    && hasAnyKeyword(targetText, ['project', 'roadmap', 'plan', 'draft', 'design', 'brief'])
  ) {
    return 'supports'
  }

  if (source.indexedPath[0] && source.indexedPath[0] === target.indexedPath[0]) {
    return 'extends'
  }

  return 'related_to'
}

export function findRelatedDocuments(
  target: WorkspaceDocument,
  workspaceDocuments: WorkspaceDocument[],
  limit = 3,
): RelatedDocument[] {
  const queryText = `${target.name}\n${target.content}`
  const targetVector = target.semanticVector && target.semanticVector.length > 0
    ? target.semanticVector
    : buildSemanticVector(target.name, target.content)

  return workspaceDocuments
    .filter(candidate => candidate.id !== target.id)
    .map(candidate => ({
      ...candidate,
      score: scoreDocumentSimilarity(
        queryText,
        candidate.name,
        candidate.content,
        [],
        candidate.semanticVector ?? buildSemanticVector(candidate.name, candidate.content),
      ),
    }))
    .filter(candidate => candidate.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export function buildExcerpt(body: string, maxLength = 550): string {
  return body
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

export function splitIntoSemanticChunks(body: string, maxChunkLength = 320): string[] {
  const normalized = body
    .replace(/\r/g, '')
    .trim()

  if (!normalized) return []

  const blocks = normalized
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean)

  const chunks: string[] = []
  let buffer = ''

  blocks.forEach(block => {
    const next = buffer ? `${buffer}\n\n${block}` : block
    if (next.length <= maxChunkLength) {
      buffer = next
      return
    }

    if (buffer) {
      chunks.push(buffer)
      buffer = ''
    }

    if (block.length <= maxChunkLength) {
      buffer = block
      return
    }

    const sentences = block
      .split(/(?<=[.!?])\s+/)
      .map(sentence => sentence.trim())
      .filter(Boolean)

    let sentenceBuffer = ''
    sentences.forEach(sentence => {
      const candidate = sentenceBuffer ? `${sentenceBuffer} ${sentence}` : sentence
      if (candidate.length <= maxChunkLength) {
        sentenceBuffer = candidate
      } else {
        if (sentenceBuffer) chunks.push(sentenceBuffer)
        sentenceBuffer = sentence
      }
    })

    if (sentenceBuffer) {
      buffer = sentenceBuffer
    }
  })

  if (buffer) chunks.push(buffer)

  return chunks.slice(0, 18)
}

export function findRelevantChunks(
  queryText: string,
  workspaceDocuments: WorkspaceDocument[],
  limit = 5,
): RetrievedChunk[] {
  if (!queryText.trim()) return []

  const scoredChunks = workspaceDocuments.flatMap(document => {
    const chunks = splitIntoSemanticChunks(document.content)

    return chunks
      .map((chunk, index) => {
        const score = scoreDocumentSimilarity(
          queryText,
          document.name,
          chunk,
          document.indexedPath.slice(0, 1),
          buildSemanticVector(document.name, chunk, document.indexedPath.slice(0, 1)),
        )

        return {
          id: `${document.id}-chunk-${index + 1}`,
          documentId: document.id,
          documentName: document.name,
          indexedPath: document.indexedPath,
          content: chunk,
          excerpt: buildExcerpt(chunk, 180),
          score,
        }
      })
      .filter(chunk => chunk.score > 0)
      .sort((left, right) => right.score - left.score)
      .slice(0, 2)
  })

  return scoredChunks
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
}

export function organizeDocument(
  target: WorkspaceDocument,
  workspaceDocuments: WorkspaceDocument[],
): OrganizationResult {
  const relatedDocuments = findRelatedDocuments(target, workspaceDocuments, 4)
  const collectionScores = COLLECTION_CANDIDATES.map(candidate => {
    const keywordScore = scoreCollectionFit(target.name, target.content, candidate)
    const relatedBoost = relatedDocuments.reduce((total, document) => {
      const samePrimaryCollection = document.indexedPath[0] === candidate.path[0]
      return total + (samePrimaryCollection ? document.score * 0.35 : 0)
    }, 0)
    const samePrimaryBoost = target.indexedPath[0] === candidate.path[0] ? 0.7 : 0
    const samePathBoost = target.indexedPath.join('/') === candidate.path.join('/') ? 0.3 : 0

    return {
      candidate,
      score: keywordScore + relatedBoost + samePrimaryBoost + samePathBoost,
    }
  }).sort((a, b) => b.score - a.score)

  const bestCollection = collectionScores[0]
  const secondBestCollection = collectionScores[1]
  const existingTopLevel = new Set(workspaceDocuments.map(document => document.indexedPath[0]).filter(Boolean))
  const inferredFallback = relatedDocuments[0]?.indexedPath.length
    ? relatedDocuments[0].indexedPath
    : existingTopLevel.has('Inbox')
      ? ['Inbox']
      : ['Unsorted']

  const indexedPath = bestCollection && bestCollection.score >= 3
    ? bestCollection.candidate.path
    : inferredFallback

  const collections = [
    indexedPath[0],
    ...relatedDocuments.map(document => document.indexedPath[0]).filter(Boolean),
  ]
    .filter((label): label is string => Boolean(label))
    .filter((label, index, values) => values.indexOf(label) === index)
    .slice(0, 3)

  const topScore = bestCollection?.score ?? 0
  const secondScore = secondBestCollection?.score ?? 0
  const separation = Math.max(0, topScore - secondScore)
  const support = relatedDocuments[0]?.score ?? 0
  const confidence = Math.max(
    0,
    Math.min(
      1,
      (Math.min(topScore / 6, 1) * 0.55)
      + (Math.min(separation / 2.5, 1) * 0.25)
      + (Math.min(support / 1.2, 1) * 0.2),
    ),
  )
  const suggestions = collectionScores
    .filter(({ score }, index) => score > 0 || index < 3)
    .slice(0, 3)
    .map(({ candidate, score }) => ({
      label: candidate.label,
      indexedPath: candidate.path,
      score,
    }))

  return {
    indexedPath,
    collections,
    relatedIds: relatedDocuments.map(document => document.id),
    relatedLinks: relatedDocuments.map(document => ({
      targetId: document.id,
      type: inferLinkType(target, document),
    })),
    confidence,
    suggestions,
  }
}
