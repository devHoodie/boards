import { DESCRIPTION_PLACEHOLDER, generateId } from './utils.js'

const CARD_FIELDS = ['text', 'description', 'listId', 'tags', 'checklist']

export { generateId }

export function defaultRevision (ts = Date.now()) {
  return {
    text: ts,
    description: ts,
    listId: ts,
    tags: ts,
    checklist: ts
  }
}

function deepEqual (a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function normalizeDescription (desc) {
  if (!desc || desc === DESCRIPTION_PLACEHOLDER) return ''
  return desc
}

function cardSnapshot (card, listId) {
  const ts = Date.now()
  const rev = card.revision || defaultRevision(ts)
  return {
    id: card.id || generateId(),
    text: card.text || '',
    description: normalizeDescription(card.description),
    listId: card.listId || listId,
    tags: card.tags || [],
    checklist: card.checklist || [],
    revision: { ...rev },
    deletedAt: card.deletedAt || null
  }
}

/** Ensure every card has id, listId, revision */
export function normalizeState (state) {
  if (!state?.lists) return state
  const tombstones = { ...(state.tombstones || {}) }
  const lists = state.lists.map(list => ({
    ...list,
    cards: (list.cards || []).map(card => {
      const snap = cardSnapshot(card, list.id)
      if (snap.deletedAt) tombstones[snap.id] = snap.deletedAt
      return snap
    }).filter(c => !c.deletedAt)
  }))
  return {
    version: 2,
    boardTitle: state.boardTitle || 'My Board',
    tags: state.tags || [],
    lists,
    tombstones
  }
}

function indexCards (state) {
  const map = new Map()
  if (!state?.lists) return map
  for (const list of state.lists) {
    for (const card of list.cards || []) {
      if (card.id && !card.deletedAt) {
        map.set(card.id, cardSnapshot(card, list.id))
      }
    }
  }
  if (state.tombstones) {
    for (const [id, deletedAt] of Object.entries(state.tombstones)) {
      if (!map.has(id)) {
        map.set(id, {
          id,
          text: '',
          description: '',
          listId: '1',
          tags: [],
          checklist: [],
          revision: defaultRevision(0),
          deletedAt
        })
      }
    }
  }
  return map
}

function maxRevision (card) {
  if (!card?.revision) return 0
  return Math.max(...CARD_FIELDS.map(f => card.revision[f] || 0))
}

function isDeleted (card) {
  if (!card?.deletedAt) return false
  return card.deletedAt >= maxRevision(card)
}

function mergeField (field, localCard, remoteCard, autoMerged, conflicts) {
  const localVal = field === 'description'
    ? normalizeDescription(localCard[field])
    : localCard[field]
  const remoteVal = field === 'description'
    ? normalizeDescription(remoteCard[field])
    : remoteCard[field]

  const revL = localCard.revision?.[field] || 0
  const revR = remoteCard.revision?.[field] || 0

  if (deepEqual(localVal, remoteVal)) {
    return { value: localVal, revision: Math.max(revL, revR) }
  }

  if (revL > revR) {
    autoMerged.push({
      cardId: localCard.id,
      cardTitle: localCard.text || remoteCard.text || 'Untitled',
      field,
      source: 'local'
    })
    return { value: localVal, revision: revL }
  }

  if (revR > revL) {
    autoMerged.push({
      cardId: remoteCard.id,
      cardTitle: localCard.text || remoteCard.text || 'Untitled',
      field,
      source: 'remote'
    })
    return { value: remoteVal, revision: revR }
  }

  conflicts.push({
    cardId: localCard.id,
    cardTitle: localCard.text || remoteCard.text || 'Untitled',
    field,
    localValue: localVal,
    remoteValue: remoteVal,
    resolution: null
  })
  return { value: localVal, revision: revL }
}

function rebuildListsFromCards (listsTemplate, cardsByList) {
  return listsTemplate.map(list => {
    const cards = cardsByList.get(list.id) || []
    return { ...list, cards }
  })
}

function listTemplate (state) {
  if (state?.lists?.length) {
    return state.lists.map(l => ({ id: l.id, title: l.title, cards: [] }))
  }
  return [
    { id: '1', title: 'BACKLOG', cards: [] },
    { id: '2', title: 'NEXT UP', cards: [] },
    { id: '3', title: 'IN PROGRESS', cards: [] },
    { id: '4', title: 'TESTING', cards: [] },
    { id: '5', title: 'DONE', cards: [] }
  ]
}

/**
 * Merge local (mine / cache) with remote (live room).
 */
export function mergeBoardStates (localState, remoteState) {
  const local = normalizeState(localState || {})
  const remote = normalizeState(remoteState || {})
  const localMap = indexCards(local)
  const remoteMap = indexCards(remote)
  const allIds = new Set([...localMap.keys(), ...remoteMap.keys()])

  const autoMerged = []
  const conflicts = []
  const mergedCards = []
  const tombstones = { ...local.tombstones, ...remote.tombstones }

  for (const id of allIds) {
    const localCard = localMap.get(id)
    const remoteCard = remoteMap.get(id)

    if (localCard && isDeleted(localCard)) {
      tombstones[id] = localCard.deletedAt
      continue
    }
    if (remoteCard && isDeleted(remoteCard)) {
      tombstones[id] = remoteCard.deletedAt
      continue
    }

    if (!localCard && remoteCard) {
      autoMerged.push({ cardId: id, cardTitle: remoteCard.text, field: '_card', source: 'remote', note: 'Card added remotely' })
      mergedCards.push({ ...remoteCard })
      continue
    }
    if (localCard && !remoteCard) {
      autoMerged.push({ cardId: id, cardTitle: localCard.text, field: '_card', source: 'local', note: 'Card only in your offline copy' })
      mergedCards.push({ ...localCard })
      continue
    }

    const merged = {
      id,
      text: localCard.text,
      description: '',
      listId: localCard.listId,
      tags: [],
      checklist: [],
      revision: { ...defaultRevision(0) },
      deletedAt: null
    }

    for (const field of CARD_FIELDS) {
      const { value, revision } = mergeField(field, localCard, remoteCard, autoMerged, conflicts)
      merged[field] = value
      merged.revision[field] = revision
    }

    mergedCards.push(merged)
  }

  const cardsByList = new Map()
  for (const card of mergedCards) {
    const listId = card.listId || '1'
    if (!cardsByList.has(listId)) cardsByList.set(listId, [])
    cardsByList.get(listId).push(card)
  }

  const template = listTemplate(remote.lists?.length ? remote : local)
  const merged = {
    version: 2,
    boardTitle: (remote.revision?.boardTitle || 0) > (local.revision?.boardTitle || 0)
      ? remote.boardTitle
      : local.boardTitle,
    tags: remote.tags?.length >= (local.tags?.length || 0) ? remote.tags : local.tags,
    lists: rebuildListsFromCards(template, cardsByList),
    tombstones
  }

  return { merged, autoMerged, conflicts }
}

export function applyConflictResolutions (merged, conflicts, resolutions) {
  const cardMap = new Map()
  for (const list of merged.lists) {
    for (const card of list.cards) cardMap.set(card.id, card)
  }

  for (const conflict of conflicts) {
    const pick = resolutions[conflict.cardId + ':' + conflict.field]
    if (!pick) continue
    const card = cardMap.get(conflict.cardId)
    if (!card) continue
    const value = pick === 'local' ? conflict.localValue : conflict.remoteValue
    card[conflict.field] = value
    card.revision[conflict.field] = Date.now()
  }

  return merged
}

export function statesEqual (a, b) {
  return JSON.stringify(normalizeState(a)) === JSON.stringify(normalizeState(b))
}

export function fieldLabel (field) {
  const labels = {
    text: 'title',
    description: 'description',
    listId: 'column',
    tags: 'tags',
    checklist: 'checklist',
    _card: 'card'
  }
  return labels[field] || field
}

export function listTitleById (state, listId) {
  const list = state?.lists?.find(l => l.id === listId)
  return list?.title || listId
}
