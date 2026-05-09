import type { PersistedDocumentSnapshot } from '../../../shared/documentSnapshot'

type DocumentPersistenceBridge = {
  loadSnapshot: () => Promise<PersistedDocumentSnapshot | null>
  saveSnapshot: (snapshot: PersistedDocumentSnapshot) => Promise<void>
}

function getBridge(): DocumentPersistenceBridge | undefined {
  return (window as Window & {
    documentPersistence?: DocumentPersistenceBridge
  }).documentPersistence
}

export async function loadPersistedSnapshot(): Promise<PersistedDocumentSnapshot | null> {
  return getBridge()?.loadSnapshot() ?? null
}

export async function savePersistedSnapshot(snapshot: PersistedDocumentSnapshot): Promise<void> {
  await getBridge()?.saveSnapshot(snapshot)
}
