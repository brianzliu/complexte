import type { PageMeta } from '../store/useDocumentStore'

interface RelationshipMapProps {
  page: PageMeta
  workspacePages: PageMeta[]
  onOpenPage: (id: string) => void
}

type MapNode = {
  id: string
  name: string
  role: 'center' | 'direct' | 'backlink' | 'neighbor'
}

type MapEdge = {
  from: string
  to: string
}

type PositionedNode = MapNode & {
  x: number
  y: number
}

function buildGraph(page: PageMeta, workspacePages: PageMeta[]): { nodes: MapNode[]; edges: MapEdge[] } {
  const pagesById = new Map(workspacePages.map(candidate => [candidate.id, candidate]))
  const nodes = new Map<string, MapNode>()
  const edges = new Map<string, MapEdge>()

  nodes.set(page.id, { id: page.id, name: page.name, role: 'center' })

  const directRelatedIds = page.relatedIds
    .filter(id => pagesById.has(id))
    .slice(0, 5)

  directRelatedIds.forEach(id => {
    const related = pagesById.get(id)
    if (!related) return
    nodes.set(id, { id, name: related.name, role: 'direct' })
    edges.set(`${page.id}:${id}`, { from: page.id, to: id })
  })

  const backlinks = workspacePages
    .filter(candidate => candidate.id !== page.id && candidate.relatedIds.includes(page.id))
    .slice(0, 4)

  backlinks.forEach(backlink => {
    if (!nodes.has(backlink.id)) {
      nodes.set(backlink.id, { id: backlink.id, name: backlink.name, role: 'backlink' })
    }
    edges.set(`${backlink.id}:${page.id}`, { from: backlink.id, to: page.id })
  })

  const neighborIds = Array.from(nodes.values())
    .filter(node => node.role !== 'center')
    .flatMap(node => pagesById.get(node.id)?.relatedIds ?? [])
    .filter(id => id !== page.id && !nodes.has(id))
    .slice(0, 4)

  neighborIds.forEach(id => {
    const neighbor = pagesById.get(id)
    if (!neighbor) return
    nodes.set(id, { id, name: neighbor.name, role: 'neighbor' })
  })

  Array.from(nodes.values())
    .filter(node => node.role !== 'center')
    .forEach(node => {
      const sourcePage = pagesById.get(node.id)
      if (!sourcePage) return
      sourcePage.relatedIds
        .filter(id => nodes.has(id))
        .slice(0, 3)
        .forEach(targetId => {
          edges.set(`${node.id}:${targetId}`, { from: node.id, to: targetId })
        })
    })

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values()),
  }
}

function getRoleClass(role: MapNode['role']): string {
  if (role === 'center') return 'center'
  if (role === 'direct') return 'direct'
  if (role === 'backlink') return 'backlink'
  return 'neighbor'
}

export default function RelationshipMap({ page, workspacePages, onOpenPage }: RelationshipMapProps) {
  const { nodes, edges } = buildGraph(page, workspacePages)
  if (nodes.length <= 1) return null

  const centerX = 50
  const centerY = 50
  const outerNodes = nodes.filter(node => node.role !== 'center')
  const positionedNodes: PositionedNode[] = nodes.map((node, index) => {
    if (node.role === 'center') {
      return { ...node, x: centerX, y: centerY }
    }

    const outerIndex = outerNodes.findIndex(candidate => candidate.id === node.id)
    const angle = (Math.PI * 2 * outerIndex) / Math.max(outerNodes.length, 1) - Math.PI / 2
    const radius = node.role === 'neighbor' ? 34 : 28
    return {
      ...node,
      x: centerX + Math.cos(angle) * radius,
      y: centerY + Math.sin(angle) * radius,
    }
  })

  const positionedNodeMap = new Map(positionedNodes.map(node => [node.id, node]))

  return (
    <section className="relationship-map-card">
      <div className="relationship-map-header">
        <div>
          <h2 className="relationship-map-title">Relationship map</h2>
          <p className="relationship-map-subtitle">A graph-lite view of how this document connects to its local workspace.</p>
        </div>
      </div>

      <div className="relationship-map-canvas">
        <svg className="relationship-map-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {edges.map(edge => {
            const from = positionedNodeMap.get(edge.from)
            const to = positionedNodeMap.get(edge.to)
            if (!from || !to) return null

            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                className={`relationship-map-edge ${from.id === page.id || to.id === page.id ? 'primary' : ''}`}
              />
            )
          })}
        </svg>

        {positionedNodes.map(node => (
          <button
            key={node.id}
            className={`relationship-map-node ${getRoleClass(node.role)} ${node.id === page.id ? 'active' : ''}`}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            onClick={() => onOpenPage(node.id)}
          >
            <span>{node.name}</span>
          </button>
        ))}
      </div>
    </section>
  )
}
