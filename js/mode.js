const params = new URLSearchParams(location.search)
const roomParam = params.get('room')

export const roomId = roomParam && roomParam !== 'local' ? roomParam : null
export const isCollabMode = Boolean(roomId)
