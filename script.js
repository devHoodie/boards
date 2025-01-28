document.addEventListener('DOMContentLoaded', () => {
  const listsContainer = document.querySelector('.lists-container')
  const errorLog = document.querySelector('.error-log')
  const tagsList = document.querySelector('.tags-list')

  // Function to log errors to the custom console
  function logError (error) {
    const errorMessage = document.createElement('div')
    errorMessage.textContent = `[Error] ${error.message || error}`
    errorLog.appendChild(errorMessage)
    errorLog.scrollTop = errorLog.scrollHeight // Auto-scroll to the latest error
  }

  // Load saved state from localStorage
  try {
    const savedState = JSON.parse(localStorage.getItem('trelloBoard')) || {}
    if (savedState.boardTitle) {
      document.querySelector('h1').textContent = savedState.boardTitle
    }
    if (savedState.tags && savedState.tags.length > 0) {
      savedState.tags.forEach(tag => {
        createTag(tag.name, tag.color)
      })
    }
    if (savedState.lists && savedState.lists.length > 0) {
      savedState.lists.forEach(list => {
        const listElement = document.querySelector(
          `[data-list-id="${list.id}"]`
        )
        if (listElement) {
          listElement.querySelector('h2').textContent = list.title
          list.cards.forEach(card => {
            const cardElement = createCard(
              listElement,
              card.text,
              card.description
            )
            if (card.tags && card.tags.length > 0) {
              card.tags.forEach(tag => {
                applyTagToCard(cardElement, tag)
              })
            }
            // Load checklist items
            if (card.checklist && card.checklist.length > 0) {
              cardElement.dataset.checklist = JSON.stringify(card.checklist)
            }
          })
        }
      })
    }
  } catch (error) {
    logError(error)
  }

  // Tag Creation
  document.getElementById('create-tag-btn').addEventListener('click', () => {
    let tagName = document.getElementById('tag-name').value.trim()
    const tagColor = document.getElementById('tag-color').value

    if (!tagName || !tagColor) {
      alert('Please enter a tag name and select a color.')
      return
    }

    // Remove any "×" characters from the tag name
    tagName = tagName.replace(/×/g, '')

    createTag(tagName, tagColor)
    document.getElementById('tag-name').value = '' // Clear input
    saveState()
  })

  // Update createTag function to include "X" button
  function createTag (name, color) {
    // Remove any "×" characters from the name
    const sanitizedName = name.replace(/×/g, '')

    const tag = document.createElement('div')
    tag.className = 'tag'
    tag.textContent = sanitizedName
    tag.style.backgroundColor = color
    tag.draggable = true

    // Add "X" button to remove the tag
    const removeButton = document.createElement('button')
    removeButton.className = 'remove-tag-btn'
    removeButton.textContent = '×'
    removeButton.addEventListener('click', () => {
      tag.remove() // Remove the tag from the DOM
      saveState() // Save state after removal
    })

    tag.appendChild(removeButton)

    // Add drag event listeners
    tag.addEventListener('dragstart', e => {
      e.dataTransfer.setData(
        'text/plain',
        JSON.stringify({ name: sanitizedName, color })
      )
    })

    tagsList.appendChild(tag)
  }

  // Apply tags to cards
  listsContainer.addEventListener('dragover', e => {
    e.preventDefault()
  })

  listsContainer.addEventListener('drop', e => {
    try {
      const card = e.target.closest('.card')
      if (card) {
        const tagData = JSON.parse(e.dataTransfer.getData('text/plain'))
        applyTagToCard(card, tagData)
        saveState()
      }
    } catch (error) {
      logError(error)
    }
  })

  function applyTagToCard (card, tagData) {
    // Check if the tag already exists on the card
    const existingTags = Array.from(card.querySelectorAll('.card-tag'))
    const tagExists = existingTags.some(tag => tag.textContent === tagData.name)

    if (tagExists) return // Don't add duplicate tags

    // Create the tag element
    const tagElement = document.createElement('div')
    tagElement.className = 'card-tag'
    tagElement.textContent = tagData.name
    tagElement.style.backgroundColor = tagData.color
    tagElement.style.setProperty('--tag-color', tagData.color)

    // Add click event to remove the tag
    tagElement.addEventListener('click', () => {
      tagElement.remove()
      updateCardBorderColor(card)
      saveState()
    })

    // Add the tag to the card
    const cardTags =
      card.querySelector('.card-tags') || document.createElement('div')
    cardTags.className = 'card-tags'
    cardTags.appendChild(tagElement)
    card.appendChild(cardTags)

    // Update the card's left border color to the first tag's color
    updateCardBorderColor(card)
  }

  function updateCardBorderColor (card) {
    const firstTag = card.querySelector('.card-tag')
    if (firstTag) {
      card.style.borderLeftColor = firstTag.style.backgroundColor
    } else {
      card.style.borderLeftColor = 'transparent' // Default to transparent if no tags are left
    }
  }
  // Add new card
  listsContainer.addEventListener('click', e => {
    try {
      if (e.target.classList.contains('add-card-btn')) {
        const listElement = e.target.closest('.list')
        if (listElement) {
          const input = listElement.querySelector('.add-card-input')
          if (input && input.value.trim()) {
            createCard(listElement, input.value.trim())
            input.value = ''
            saveState()
          } else {
            logError('Input field is empty or not found.')
          }
        } else {
          logError('List element not found.')
        }
      }
    } catch (error) {
      logError(error)
    }
  })

  // Add new card on pressing Enter in the input field
  listsContainer.addEventListener('keypress', e => {
    try {
      if (
        e.target.classList.contains('add-card-input') &&
        e.key === 'Enter' &&
        e.target.value.trim()
      ) {
        const listElement = e.target.closest('.list')
        if (listElement) {
          createCard(listElement, e.target.value.trim())
          e.target.value = ''
          saveState()
        }
      }
    } catch (error) {
      logError(error)
    }
  })

  // Edit column titles and save on pressing Enter
  listsContainer.addEventListener('keypress', e => {
    try {
      if (e.target.tagName === 'H2' && e.key === 'Enter') {
        e.preventDefault()
        e.target.blur() // Exit edit mode
        saveState()
      }
    } catch (error) {
      logError(error)
    }
  })

  // Save list title changes on blur (when focus is lost)
  listsContainer.addEventListener(
    'blur',
    e => {
      try {
        if (e.target.tagName === 'H2') {
          saveState()
        }
      } catch (error) {
        logError(error)
      }
    },
    true
  )

  // Delete card
  listsContainer.addEventListener('click', e => {
    try {
      if (e.target.classList.contains('delete-card-btn')) {
        const card = e.target.closest('.card')
        if (card) {
          card.remove()
          saveState()
        }
      }
    } catch (error) {
      logError(error)
    }
  })

  // Edit card name
  listsContainer.addEventListener('click', e => {
    try {
      if (e.target.classList.contains('card-name')) {
        e.target.contentEditable = true
        placeCaretAtEnd(e.target) // Move cursor to the end of the text
        e.target.focus()
      }
    } catch (error) {
      logError(error)
    }
  })

  // Save card name changes on blur
  listsContainer.addEventListener(
    'blur',
    e => {
      try {
        if (e.target.classList.contains('card-name')) {
          e.target.contentEditable = false
          saveState()
        }
      } catch (error) {
        logError(error)
      }
    },
    true
  )

  // Edit card description
  listsContainer.addEventListener('click', e => {
    try {
      if (e.target.classList.contains('card-description')) {
        const descriptionElement = e.target
        if (
          descriptionElement.textContent === 'Click to add a description...'
        ) {
          descriptionElement.textContent = '' // Clear placeholder text
        }
        descriptionElement.contentEditable = true
        placeCaretAtEnd(descriptionElement) // Move cursor to the end of the text
        descriptionElement.focus()
      }
    } catch (error) {
      logError(error)
    }
  })

  // Save card description changes on blur
  listsContainer.addEventListener(
    'blur',
    e => {
      try {
        if (e.target.classList.contains('card-description')) {
          e.target.contentEditable = false
          if (e.target.textContent.trim() === '') {
            e.target.textContent = 'Click to add a description...' // Restore placeholder if empty
          }
          saveState()
        }
      } catch (error) {
        logError(error)
      }
    },
    true
  )

  // Export board state
  document.getElementById('export-btn').addEventListener('click', async () => {
    try {
      const state = JSON.parse(localStorage.getItem('trelloBoard'))
      if (!state) {
        alert('No data to export!')
        return
      }

      // Get the board title for the filename
      const boardTitle = state.boardTitle || 'trello-board' // Fallback to 'trello-board' if no title
      const sanitizedTitle = boardTitle.replace(/[^a-zA-Z0-9_\-]/g, '_') // Remove/replace invalid characters

      // Create a Blob with the board data
      const blob = new Blob([JSON.stringify(state, null, 2)], {
        type: 'application/json'
      })

      // Use the File System Access API to let the user choose the file path
      if (window.showSaveFilePicker) {
        const handle = await window.showSaveFilePicker({
          suggestedName: `${sanitizedTitle}-export.json`,
          types: [
            {
              description: 'JSON Files',
              accept: { 'application/json': ['.json'] }
            }
          ]
        })

        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
      } else {
        // Fallback for browsers that do not support the File System Access API
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${sanitizedTitle}-export.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      logError(error)
    }
  })

  // Import board state
  document.getElementById('import-btn').addEventListener('click', () => {
    document.getElementById('import-file').click() // Trigger file input
  })

  document.getElementById('import-file').addEventListener('change', e => {
    try {
      const file = e.target.files[0]
      if (!file) return

      const reader = new FileReader()
      reader.onload = event => {
        const state = JSON.parse(event.target.result)
        if (!state) {
          alert('Invalid file!')
          return
        }

        // Clear the current board
        const listsContainer = document.querySelector('.lists-container')
        listsContainer.innerHTML = ''

        // Clear all existing tags from the Available Tags section
        const tagsList = document.querySelector('.tags-list')
        tagsList.innerHTML = '' // Clear the tags list

        // Load the imported state
        if (state.boardTitle) {
          document.querySelector('h1').textContent = state.boardTitle
        }
        if (state.tags && state.tags.length > 0) {
          state.tags.forEach(tag => {
            createTag(tag.name, tag.color) // Create new tags from the imported state
          })
        }
        if (state.lists && state.lists.length > 0) {
          state.lists.forEach(list => {
            const listElement = document.createElement('div')
            listElement.className = 'list'
            listElement.setAttribute('data-list-id', list.id)
            listElement.innerHTML = `
            <h2 contenteditable="true">${list.title}</h2>
            <input type="text" class="add-card-input" placeholder="Add a card...">
            <button class="add-card-btn">Add Card</button>
            <div class="cards"></div>
          `
            listsContainer.appendChild(listElement)
            listElement.querySelector('h2').textContent = list.title
            list.cards.forEach(card => {
              const cardElement = createCard(
                listElement,
                card.text,
                card.description
              )
              if (card.tags && card.tags.length > 0) {
                card.tags.forEach(tag => {
                  applyTagToCard(cardElement, tag)
                })
              }
              // Load checklist items
              if (card.checklist && card.checklist.length > 0) {
                cardElement.dataset.checklist = JSON.stringify(card.checklist)
              }
            })
          })
        }

        // Save the imported state to localStorage
        localStorage.setItem('trelloBoard', JSON.stringify(state))
        alert('Board imported successfully!')
      }
      reader.readAsText(file)

      document.getElementById('card-detail-view').style.display = 'none'
    } catch (error) {
      logError(error)
      alert('Failed to import board. Please check the file format.')
    }
  })

  // Add reset board functionality
  document.getElementById('reset-board-btn').addEventListener('click', () => {
    if (
      confirm(
        'Are you sure you want to reset the board? This action cannot be undone.'
      )
    ) {
      localStorage.removeItem('trelloBoard')
      location.reload() // Reload the page to reset the board
    }
  })
  // Drag-and-drop functionality
  let draggedCard = null

  listsContainer.addEventListener('dragstart', e => {
    try {
      if (e.target.classList.contains('card')) {
        draggedCard = e.target
        draggedCard.classList.add('dragging') // Add dragging class
        setTimeout(() => e.target.classList.add('dragging'), 0)
      }
    } catch (error) {
      logError(error)
    }
  })

  listsContainer.addEventListener('dragend', e => {
    try {
      if (e.target.classList.contains('card')) {
        e.target.classList.remove('dragging') // Remove dragging class
        draggedCard = null
        saveState()
      }
    } catch (error) {
      logError(error)
    }
  })

  listsContainer.addEventListener('dragover', e => {
    try {
      e.preventDefault()
      const closestList = getClosestList(e.clientX, e.clientY)
      if (closestList) {
        const closestCard = getClosestCard(e.clientY, closestList)
        if (closestCard) {
          closestCard.parentNode.insertBefore(draggedCard, closestCard)
        } else {
          // If no closest card, append to the end of the list
          closestList.querySelector('.cards').appendChild(draggedCard)
        }
      }
    } catch (error) {
      logError(error)
    }
  })

  function getClosestCard (y, list) {
    const cards = Array.from(list.querySelectorAll('.card:not(.dragging)'))
    return cards.reduce(
      (closest, card) => {
        const box = card.getBoundingClientRect()
        const offset = y - box.top // Calculate offset from the top of the card
        // If the mouse is above the card and closer than the previous closest card
        if (offset < 0 && offset > closest.offset) {
          return { offset, element: card }
        } else {
          return closest
        }
      },
      { offset: Number.NEGATIVE_INFINITY }
    ).element
  }

  function getClosestList (x, y) {
    const lists = Array.from(document.querySelectorAll('.list'))
    return lists.reduce(
      (closest, list) => {
        const box = list.getBoundingClientRect()
        const offsetX = x - box.left - box.width / 2
        const offsetY = y - box.top
        // Check if the mouse is within the list's boundaries
        if (
          offsetX < 0 &&
          offsetX > closest.offsetX &&
          offsetY >= 0 &&
          offsetY <= box.height
        ) {
          return { offsetX, element: list }
        } else {
          return closest
        }
      },
      { offsetX: Number.NEGATIVE_INFINITY }
    ).element
  }

  function createCard (listElement, text, description = '') {
    const card = document.createElement('div')
    card.className = 'card'
    card.draggable = true

    // Add card name
    const cardName = document.createElement('div')
    cardName.className = 'card-name'
    cardName.textContent = text
    card.appendChild(cardName)

    // Add description if it exists
    const descriptionElement = document.createElement('div')
    descriptionElement.className = 'card-description'
    descriptionElement.textContent =
      description || 'Click to add a description...'
    card.appendChild(descriptionElement)

    // Add delete button
    const deleteButton = document.createElement('button')
    deleteButton.className = 'delete-card-btn'
    deleteButton.textContent = '×'
    card.appendChild(deleteButton)

    // Add container for tags
    const cardTags = document.createElement('div')
    cardTags.className = 'card-tags'
    card.appendChild(cardTags)

    // Initialize checklist data
    card.dataset.checklist = JSON.stringify([])

    listElement.querySelector('.cards').appendChild(card)
    return card
  }

  // Update the saveState function to include checklist items
  function saveState () {
    try {
      const boardTitle = document.querySelector('h1').textContent
      const lists = document.querySelectorAll('.list')
      const tags = Array.from(document.querySelectorAll('.tag')).map(tag => ({
        name: tag.textContent.replace(/×/g, ''), // Remove "×" before saving
        color: tag.style.backgroundColor
      }))
      const state = {
        boardTitle,
        tags,
        lists: []
      }
      lists.forEach(list => {
        const title = list.querySelector('h2').textContent
        const cards = Array.from(list.querySelectorAll('.card')).map(card => ({
          text: card.querySelector('.card-name').textContent, // Save card name
          description: card.querySelector('.card-description').textContent, // Save card description
          tags: Array.from(card.querySelectorAll('.card-tag')).map(tag => ({
            name: tag.textContent.replace(/×/g, ''), // Remove "×" before saving
            color: tag.style.backgroundColor
          })),
          checklist: card.dataset.checklist
            ? JSON.parse(card.dataset.checklist)
            : [] // Save checklist
        }))
        state.lists.push({ id: list.dataset.listId, title, cards })
      })
      localStorage.setItem('trelloBoard', JSON.stringify(state))
    } catch (error) {
      logError(error)
    }
  }
  // Add event listener to close the detailed view window
  document
    .getElementById('close-card-detail-btn')
    .addEventListener('click', () => {
      document.getElementById('card-detail-view').style.display = 'none'
    })

  // Event listener to show detailed view when clicking on the card's empty space
  listsContainer.addEventListener('click', e => {
    try {
      const card = e.target.closest('.card')
      if (
        card &&
        !e.target.classList.contains('card-name') &&
        !e.target.classList.contains('card-description')
      ) {
        showCardDetail(card)
      }
    } catch (error) {
      logError(error)
    }
  })
  let currentCard = null

  // Function to show the detailed view of a card
  function showCardDetail (card) {
    // Save the current card's state before switching
    if (currentCard) {
      saveCurrentCardState()
    }

    // Set the new card as the current card
    currentCard = card

    // Populate the detailed view window with the new card's data
    const cardName = card.querySelector('.card-name').textContent
    const cardDescription = card.querySelector('.card-description').textContent
    const cardTags = card.querySelectorAll('.card-tag')

    document.getElementById('card-detail-name').textContent = cardName
    document.getElementById('card-detail-description').textContent =
      cardDescription

    // Clear previous tags and load new ones
    const tagsContainer = document.getElementById('card-detail-tags')
    tagsContainer.innerHTML = ''
    cardTags.forEach(tag => {
      const tagElement = document.createElement('div')
      tagElement.className = 'card-detail-tag'
      tagElement.textContent = tag.textContent
      tagElement.style.backgroundColor = tag.style.backgroundColor
      tagsContainer.appendChild(tagElement)
    })

    // Load checklist items
    const checklistItems = card.dataset.checklist
      ? JSON.parse(card.dataset.checklist)
      : []
    const checklistContainer = document.getElementById('checklist-items')
    checklistContainer.innerHTML = ''
    checklistItems.forEach(item => {
      addChecklistItem(checklistContainer, item.text, item.checked)
    })

    // Show the detailed view window
    document.getElementById('card-detail-view').style.display = 'block'
  }
  // Function to save the current card's state
  function saveCurrentCardState () {
    if (currentCard) {
      const cardName = document.getElementById('card-detail-name').textContent
      const cardDescription = document.getElementById(
        'card-detail-description'
      ).textContent

      // Update the smaller card
      currentCard.querySelector('.card-name').textContent = cardName
      currentCard.querySelector('.card-description').textContent =
        cardDescription

      // Save checklist items
      const checklistItems = Array.from(
        document.querySelectorAll('.checklist-item')
      ).map(item => ({
        text: item.querySelector('input[type="text"]').value,
        checked: item.querySelector('input[type="checkbox"]').checked
      }))
      currentCard.dataset.checklist = JSON.stringify(checklistItems)

      // Save the state to localStorage
      saveState()
    }
  }
  // Function to add a checklist item
  function addChecklistItem (container, text = '', checked = false) {
    const checklistItem = document.createElement('div')
    checklistItem.className = 'checklist-item'

    // Add checkbox
    const checkbox = document.createElement('input')
    checkbox.type = 'checkbox'
    checkbox.checked = checked
    checkbox.addEventListener('change', () => {
      textInput.classList.toggle('checked', checkbox.checked)
      saveState()
    })
    checklistItem.appendChild(checkbox)

    // Add text input
    const textInput = document.createElement('input')
    textInput.type = 'text'
    textInput.value = text
    textInput.placeholder = 'Enter checklist item...'
    textInput.classList.toggle('checked', checked) // Apply strikethrough if checked
    textInput.addEventListener('input', () => saveState()) // Save on text change
    checklistItem.appendChild(textInput)

    // Add remove button
    const removeButton = document.createElement('button')
    removeButton.textContent = '-'
    removeButton.addEventListener('click', () => {
      checklistItem.remove()
      saveState()
    })
    checklistItem.appendChild(removeButton)

    container.appendChild(checklistItem)
  }

  // Add event listener to add new checklist items
  document
    .getElementById('add-checklist-item-btn')
    .addEventListener('click', () => {
      const checklistContainer = document.getElementById('checklist-items')
      addChecklistItem(checklistContainer)
      saveState()
    })

  // Add event listener to save changes when the detailed view window is closed
  document
    .getElementById('close-card-detail-btn')
    .addEventListener('click', () => {
      if (currentCard) {
        const cardName = document.getElementById('card-detail-name').textContent
        const cardDescription = document.getElementById(
          'card-detail-description'
        ).textContent

        // Update the smaller card
        currentCard.querySelector('.card-name').textContent = cardName
        currentCard.querySelector('.card-description').textContent =
          cardDescription

        // Save checklist items
        const checklistItems = Array.from(
          document.querySelectorAll('.checklist-item')
        ).map(item => ({
          text: item.querySelector('input[type="text"]').value,
          checked: item.querySelector('input[type="checkbox"]').checked
        }))
        currentCard.dataset.checklist = JSON.stringify(checklistItems)

        saveState()
      }
    })

  // Function to place the caret at the end of an editable element
  function placeCaretAtEnd (element) {
    const range = document.createRange()
    const selection = window.getSelection()
    range.selectNodeContents(element)
    range.collapse(false) // Collapse range to the end
    selection.removeAllRanges()
    selection.addRange(range)
  }
})
