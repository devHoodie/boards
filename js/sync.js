import { $, logError } from './utils.js'
import {
  enableCollabMode,
  collectBoardState,
  applyImportedState,
  setSaveStatus
} from './state.js'
import { showToast } from './ui/toast.js'
import { roomId } from './mode.js'

const SEED_URL = 'data/seed-board.json'
const SEED_TIMEOUT_MS = 3000

let lastSyncedJson = ''
let yMap = null
let provider = null
let applyingRemote = false

async function loadYjsStack () {
  const [Y, webrtc, indexeddb] = await Promise.all([
    import('https://esm.sh/yjs@13.6.20'),
    import('https://esm.sh/y-webrtc@10.3.0'),
    import('https://esm.sh/y-indexeddb@9.0.12')
  ])
  return { Y, WebrtcProvider: webrtc.WebrtcProvider, IndexeddbPersistence: indexeddb.IndexeddbPersistence }
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
  if (!json || json === lastSyncedJson) return
  try {
    applyingRemote = true
    lastSyncedJson = json
    const state = JSON.parse(json)
    if (state?.lists) {
      applyImportedState(state, boardHelpers, { persistLocal: false })
      setSaveStatus('Synced')
    }
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

async function waitForInitialState (ymap, boardHelpers) {
  const existing = ymap.get('state')
  if (existing) {
    applyRemoteState(existing, boardHelpers)
    return
  }

  setSaveStatus('Connecting…')
  const start = Date.now()

  await new Promise(resolve => {
    const check = () => {
      const json = ymap.get('state')
      if (json) {
        applyRemoteState(json, boardHelpers)
        resolve()
        return
      }
      if (Date.now() - start >= SEED_TIMEOUT_MS) {
        resolve()
        return
      }
      setTimeout(check, 200)
    }
    check()
  })

  if (ymap.get('state')) return

  const seed = await fetchSeedState()
  if (seed?.lists) {
    applyImportedState(seed, boardHelpers, { persistLocal: false })
    pushToYjs(collectBoardState())
    setSaveStatus('Seed loaded')
  } else {
    setSaveStatus('Live')
  }
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
    await waitForInitialState(yMap, boardHelpers)
    updatePeerStatus(provider)
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
