import { $, logError } from './utils.js'
import { getStoredState } from './state.js'
import { showToast } from './ui/toast.js'
import { openModal, closeModal } from './ui/modal.js'

const CLIENT_ID = '335040636187-i7q62kbk78satg81n2o6t418sqop4cuk.apps.googleusercontent.com'
const API_KEY = 'AIzaSyC5PBk8xEvMYX0Xon_tZ6HESbxeuD4QUm0'
const DISCOVERY_DOCS = ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest']
const SCOPES = 'https://www.googleapis.com/auth/drive.file'

let gapiInited = false
let buttonRendered = false

function showGoogleButtons (signedIn) {
  const signin = $('#g_id_signin')
  if (signin) signin.style.display = signedIn ? 'none' : 'block'
  $('#signout_button').hidden = !signedIn
  $('#google-save-btn').hidden = !signedIn
  $('#google-load-btn').hidden = !signedIn
}

export function ensureGoogleButton () {
  if (buttonRendered || typeof google === 'undefined') return
  google.accounts.id.renderButton($('#g_id_signin'), {
    theme: 'outline',
    size: 'large',
    type: 'standard'
  })
  buttonRendered = true
}

async function initializeGapiClient () {
  await gapi.client.init({
    apiKey: API_KEY,
    clientId: CLIENT_ID,
    discoveryDocs: DISCOVERY_DOCS,
    scope: SCOPES
  })
  gapiInited = true
}

function initializeGoogleIdentity () {
  google.accounts.id.initialize({
    client_id: CLIENT_ID,
    callback: handleCredentialResponse,
    auto_select: false,
    cancel_on_tap_outside: false
  })
}

async function handleCredentialResponse (response) {
  try {
    if (!response.credential) throw new Error('No credential received')
    if (!gapiInited) await initializeGapiClient()

    const client = google.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPES,
      callback: async tokenResponse => {
        if (tokenResponse?.access_token) {
          gapi.client.setToken(tokenResponse)
          showGoogleButtons(true)
          try {
            const userInfo = await gapi.client.drive.about.get({ fields: 'user' })
            console.log('Signed in as: ' + userInfo.result.user.emailAddress)
          } catch (error) {
            logError('Failed to get user info: ' + error)
          }
        }
      }
    })

    client.requestAccessToken()
  } catch (error) {
    logError(error)
    showGoogleButtons(false)
  }
}

async function saveToGoogleDrive () {
  try {
    const token = gapi.client.getToken()
    if (!token) {
      showToast('Please sign in first', 'error')
      return
    }

    const state = getStoredState()
    if (!state.lists) {
      showToast('No data to save', 'error')
      return
    }

    const boardTitle = state.boardTitle || 'trello-board'
    const sanitizedTitle = boardTitle.replace(/[^a-zA-Z0-9_\-]/g, '_')
    const content = JSON.stringify(state, null, 2)

    const listResponse = await fetch(
      'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
        q: `name contains '${sanitizedTitle}' and mimeType='application/json'`,
        fields: 'files(id,name)',
        spaces: 'drive'
      }),
      { headers: { Authorization: `Bearer ${token.access_token}` } }
    )

    if (!listResponse.ok) throw new Error(`HTTP error! status: ${listResponse.status}`)

    const existingFiles = await listResponse.json()
    let fileId = null
    let fileName = `${sanitizedTitle}-${new Date().toISOString().split('T')[0]}.json`

    if (existingFiles.files?.length > 0) {
      const fileList = existingFiles.files.map(f => f.name).join('\n')
      const shouldOverwrite = confirm(
        `Found existing board files:\n\n${fileList}\n\nOverwrite an existing file? OK to select, Cancel to create new.`
      )

      if (shouldOverwrite) {
        const selectedFileName = prompt('Enter exact file name to overwrite:', existingFiles.files[0].name)
        if (!selectedFileName) return
        const selectedFile = existingFiles.files.find(f => f.name === selectedFileName)
        if (!selectedFile) {
          showToast('File not found — creating new file', 'error')
        } else {
          fileId = selectedFile.id
          fileName = selectedFile.name
        }
      }
    }

    const fileMetadata = { name: fileName, mimeType: 'application/json' }
    const form = new FormData()
    form.append('metadata', new Blob([JSON.stringify(fileMetadata)], { type: 'application/json' }))
    form.append('file', new Blob([content], { type: 'application/json' }))

    const url = fileId
      ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart'

    const response = await fetch(url, {
      method: fileId ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${token.access_token}` },
      body: form
    })

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    showToast(`Board ${fileId ? 'updated' : 'saved'} to Google Drive`)
  } catch (error) {
    logError(error)
    if (error.status === 401 || error.message?.includes('401')) {
      showToast('Authorization failed — sign in again', 'error')
      showGoogleButtons(false)
    } else {
      showToast('Failed to save to Google Drive', 'error')
    }
  }
}

async function loadFromGoogleDrive () {
  try {
    const token = gapi.client.getToken()
    if (!token) {
      showToast('Please sign in first', 'error')
      return
    }

    const response = await fetch(
      'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({
        q: "mimeType='application/json'",
        fields: 'files(id,name,modifiedTime)',
        orderBy: 'modifiedTime desc',
        spaces: 'drive'
      }),
      { headers: { Authorization: `Bearer ${token.access_token}` } }
    )

    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

    const result = await response.json()
    const files = result.files

    if (!files?.length) {
      showToast('No saved boards found in Google Drive', 'error')
      return
    }

    const fileList = $('#drive-file-list')
    fileList.innerHTML = ''

    files.forEach(file => {
      const item = document.createElement('div')
      item.className = 'drive-file-item'
      const modifiedDate = new Date(file.modifiedTime).toLocaleString()
      item.innerHTML = `<span>${file.name}</span><span class="drive-file-date">${modifiedDate}</span>`
      item.addEventListener('click', async () => {
        try {
          const contentResponse = await fetch(
            `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
            { headers: { Authorization: `Bearer ${token.access_token}` } }
          )
          if (!contentResponse.ok) throw new Error(`HTTP error! status: ${contentResponse.status}`)
          const content = await contentResponse.json()
          localStorage.setItem('trelloBoard', JSON.stringify(content))
          closeModal('drive-modal')
          location.reload()
        } catch (error) {
          logError(error)
          showToast('Failed to load board', 'error')
        }
      })
      fileList.appendChild(item)
    })

    openModal('drive-modal')
  } catch (error) {
    logError(error)
    if (error.status === 401 || error.message?.includes('401')) {
      showToast('Authorization failed — sign in again', 'error')
      showGoogleButtons(false)
    } else {
      showToast('Failed to load from Google Drive', 'error')
    }
  }
}

function loadGoogleAPI () {
  const script = document.createElement('script')
  script.src = 'https://apis.google.com/js/api.js'
  script.onload = () => {
    gapi.load('client:auth2', async () => {
      try {
        await initializeGapiClient()
        initializeGoogleIdentity()
      } catch (error) {
        logError(error)
      }
    })
  }
  document.body.appendChild(script)
}

export function initGoogleDrive () {
  $('#signout_button')?.addEventListener('click', async () => {
    try {
      const token = gapi.client.getToken()
      if (token !== null) {
        google.accounts.oauth2.revoke(token.access_token)
        gapi.client.setToken('')
      }
      google.accounts.id.disableAutoSelect()
      showGoogleButtons(false)
    } catch (error) {
      logError(error)
    }
  })

  $('#google-save-btn')?.addEventListener('click', saveToGoogleDrive)
  $('#google-load-btn')?.addEventListener('click', loadFromGoogleDrive)

  const waitForGoogle = setInterval(() => {
    if (typeof google !== 'undefined') {
      clearInterval(waitForGoogle)
      loadGoogleAPI()
    }
  }, 100)
}
