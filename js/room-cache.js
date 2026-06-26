const cacheKey = roomId => `boards-room-cache-${roomId}`

export function saveRoomCache (roomId, state) {
  if (!roomId || !state) return
  try {
    localStorage.setItem(cacheKey(roomId), JSON.stringify(state))
  } catch {
    // quota exceeded — ignore
  }
}

export function loadRoomCache (roomId) {
  if (!roomId) return null
  try {
    const raw = localStorage.getItem(cacheKey(roomId))
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function clearRoomCache (roomId) {
  if (!roomId) return
  localStorage.removeItem(cacheKey(roomId))
}
