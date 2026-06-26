import { $, logError } from './utils.js'
import {
  enableCollabMode,
  collectBoardState,
  applyImportedState,
  setSaveStatus,
  flushCollabState,
  setLastCollectedState
} from './state.js'
import { showToast } from './ui/toast.js'
import { roomId } from './mode.js'
import { saveRoomCache, loadRoomCache } from './room-cache.js'
import { mergeBoardStates, normalizeState, statesEqual } from './merge.js'
import { showMergeReview } from './ui/merge-modal.js'

const SEED_URL = 'data/seed-board.json'
const PEER_WAIT_MS = 3000

let lastSyncedJson = ''
let yMap = null
let provider = null
let applyingRemote = false
let joinResolved = false

async function loadYjsStack () {
  const [Y, webrtc, indexeddb] = await Promise.all([
    import('https://esm.sh/yjs@13.6.20'),
    import('https://esm.sh/y-webrtc@10.3.0'),
    import('https://esm.sh/y-indexeddb@9.0.12')
  ])
  return { Y, WebrtcProvider: webrtc.WebrtcProvider, IndexeddbPersistence: indexeddb.IndexeddbPersistence }
}

function getRemotePeerCount () {
  if (!provider?.room?.webrtcConns) return 0
  return provider.room.webrtcConns.size
}

function updatePeerStatus (webrtcProvider, event) {
  const el = $('#collab-status')
  if (!el) return
  const remotePeers = event?.webrtcPeers?.length ??
    (webrtcProvider?.room?.webrtcConns
      ? webrtcProvider.room.webrtcConns.size
      : 0)
  const total = remotePeers + 1
  el.textContent = `Live · ${total} peer${total === 1 ? '' : 's'}`
  el.classList.remove('connecting')
}

function pushToYjs (state) {
  if (!yMap || applyingRemote) return
  const json = JSON.stringify(state)
  if (json === lastSyncedJson) return
  lastSyncedJson = json
  yMap.set('state', json)
}

function applyRemoteState (json, boardHelpers) {
  if (!json || applyingRemote || !joinResolved) return
  if (json === lastSyncedJson) return

  try {
    applyingRemote = true
    const remote = normalizeState(JSON.parse(json))
    const current = normalizeState(collectBoardState())
    const { merged } = mergeBoardStates(current, remote)

    if (statesEqual(current, merged)) {
      lastSyncedJson = json
      return
    }

    lastSyncedJson = JSON.stringify(merged)
    applyImportedState(merged, boardHelpers, { persistLocal: false })
    setSaveStatus('Synced')
  } catch (error) {
    logError(error)
  } finally {
    applyingRemote = false
  }
}

async function fetchSeedState () {
  try {
    const res = await fetch(SEED_URL)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function waitMs (ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function parseLiveState () {
  const json = yMap?.get('state')
  if (!json) return null
  try {
    return normalizeState(JSON.parse(json))
  } catch {
    return null
  }
}

async function resolveJoinState (room, boardHelpers) {
  await waitMs(PEER_WAIT_MS)

  const cacheRaw = loadRoomCache(room)
  const cache = cacheRaw ? normalizeState(cacheRaw) : null
  const live = parseLiveState()
  const remotePeers = getRemotePeerCount()

  const applyAndTrack = (state) => {
    applyImportedState(state, boardHelpers, { persistLocal: false })
    const json = JSON.stringify(state)
    lastSyncedJson = json
    setLastCollectedState(state)
  }

  if (remotePeers === 0) {
    if (cache?.lists?.length) {
      applyAndTrack(cache)
      pushToYjs(cache)
      saveRoomCache(room, cache)
      setSaveStatus('Live')
    } else if (live?.lists?.length) {
      applyAndTrack(live)
      setSaveStatus('Live')
    } else {
      const seed = await fetchSeedState()
      if (seed?.lists) {
        const normalized = normalizeState(seed)
        applyAndTrack(normalized)
        pushToYjs(normalized)
        setSaveStatus('Seed loaded')
      } else {
        setSaveStatus('Live')
      }
    }
    return
  }

  if (!cache) {
    if (live?.lists?.length) {
      applyAndTrack(live)
    }
    setSaveStatus('Synced')
    return
  }

  if (!live?.lists?.length) {
    applyAndTrack(cache)
    pushToYjs(cache)
    saveRoomCache(room, cache)
    setSaveStatus('Synced')
    return
  }

  if (statesEqual(cache, live)) {
    applyAndTrack(live)
    setSaveStatus('Synced')
    return
  }

  const mergeResult = mergeBoardStates(cache, live)

  await showMergeReview({
    roomId: room,
    localState: cache,
    remoteState: live,
    mergeResult,
    onApply: (merged) => {
      const normalized = normalizeState(merged)
      applyAndTrack(normalized)
      pushToYjs(normalized)
      saveRoomCache(room, normalized)
      setSaveStatus('Synced')
    },
    onUseLive: () => {
      applyAndTrack(live)
      saveRoomCache(room, live)
      setSaveStatus('Synced')
    },
    onUseMine: () => {
      applyAndTrack(cache)
      pushToYjs(cache)
      saveRoomCache(room, cache)
      setSaveStatus('Synced')
    }
  })
}

function setupPagehideCache (room) {
  window.addEventListener('pagehide', () => {
    try {
      const state = flushCollabState()
      saveRoomCache(room, state)
      setSaveStatus('Offline cache saved')
    } catch (error) {
      logError(error)
    }
  })
}

export async function initCollab (room, boardHelpers) {
  const statusEl = $('#collab-status')
  if (statusEl) {
    statusEl.hidden = false
    statusEl.classList.add('connecting')
    statusEl.textContent = 'Connecting…'
  }

  document.body.classList.add('collab-mode')

  const collabMenu = $('#collab-menu-section')
  const localMenu = $('#local-menu-section')
  if (collabMenu) collabMenu.hidden = false
  if (localMenu) localMenu.hidden = true

  const resetBtn = $('#reset-board-btn')
  if (resetBtn) resetBtn.hidden = true

  try {
    const { Y, WebrtcProvider, IndexeddbPersistence } = await loadYjsStack()

    const doc = new Y.Doc()
    const persistence = new IndexeddbPersistence(`boards-room-${room}`, doc)
    yMap = doc.getMap('board')

    provider = new WebrtcProvider(`boards-${room}`, doc, {
      signaling: [
        'wss://signaling.yjs.dev',
        'wss://y-webrtc-signaling-eu.herokuapp.com',
        'wss://y-webrtc-signaling-us.herokuapp.com'
      ]
    })

    enableCollabMode(pushToYjs)

    yMap.observe(() => {
      const json = yMap.get('state')
      applyRemoteState(json, boardHelpers)
    })

    provider.on('peers', (data) => {
      const event = Array.isArray(data) ? data[0] : data
      updatePeerStatus(provider, event)
    })
    provider.on('synced', () => updatePeerStatus(provider))

    await persistence.whenSynced
    await resolveJoinState(room, boardHelpers)
    joinResolved = true
    updatePeerStatus(provider)
    setupPagehideCache(room)
  } catch (error) {
    logError(error)
    if (statusEl) {
      statusEl.textContent = 'Sync error'
      statusEl.classList.remove('connecting')
    }
    showToast('Failed to connect to shared room', 'error')
  }
}

export function resetCollabRoom () {
  if (!confirm('Reset the shared room for everyone? This cannot be undone.')) return
  if (yMap) {
    yMap.delete('state')
    lastSyncedJson = ''
  }
  location.reload()
}

export function copyRoomLink () {
  const url = new URL(location.href)
  url.searchParams.set('room', roomId || 'public')
  navigator.clipboard.writeText(url.toString()).then(
    () => showToast('Room link copied'),
    () => showToast('Could not copy link', 'error')
  )
}
