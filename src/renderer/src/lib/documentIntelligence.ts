type WorkspaceDocument = {
  id: string
  name: string
  indexedPath: string[]
  content: string
  semanticVector?: number[]
}

type CollectionCandidate = {
  label: string
  path: string[]
  keywords: string[]
}

type RelatedDocument = WorkspaceDocument & {
  score: number
}

type OrganizationResult = {
  indexedPath: string[]
  collections: string[]
  relatedIds: string[]
  confidence: number
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

    return {
      candidate,
      score: keywordScore + relatedBoost,
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

  return {
    indexedPath,
    collections,
    relatedIds: relatedDocuments.map(document => document.id),
    confidence,
  }
}
