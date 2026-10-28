import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTypescript } from './load-typescript.mjs'

function createDevStoreMock() {
  let state = {}
  const mockSet = (updater) => {
    state = typeof updater === 'function' ? { ...state, ...updater(state) } : { ...state, ...updater }
  }
  const mockGet = () => state

  const mockLocalStorage = {
    getItem: () => null,
    setItem: () => {}
  }

  const { useDevStore } = loadTypescript('src/store/useDevStore.ts', {
    zustand: {
      create: (fn) => {
        state = fn(mockSet, mockGet)
        return {
          getState: mockGet,
          setState: mockSet,
          subscribe: () => () => {}
        }
      }
    }
  }, {
    localStorage: mockLocalStorage,
    window: {}
  })

  return useDevStore
}

test('Kanban cards can be moved across columns and reordered via drag-and-drop', () => {
  const store = createDevStoreMock()
  const initial = store.getState().kanbanCards
  assert.ok(initial.length >= 3)

  const card1 = initial[0]
  const targetCol = card1.column === 'done' ? 'backlog' : 'done'

  // Move card1 to target column
  store.getState().moveKanbanCard(card1.id, targetCol)
  const updatedCard = store.getState().kanbanCards.find(c => c.id === card1.id)
  assert.equal(updatedCard.column, targetCol)

  // Reorder card relative to another card (drag before / after)
  const allCards = store.getState().kanbanCards
  const targetCard = allCards.find(c => c.id !== card1.id)
  assert.ok(targetCard)

  store.getState().reorderKanbanCard(card1.id, targetCard.id, 'before')
  const reorderedCards = store.getState().kanbanCards
  const newIndex1 = reorderedCards.findIndex(c => c.id === card1.id)
  const newIndexTarget = reorderedCards.findIndex(c => c.id === targetCard.id)
  assert.equal(newIndex1, newIndexTarget - 1)
  assert.equal(reorderedCards.find(c => c.id === card1.id).column, targetCard.column)

  store.getState().reorderKanbanCard(card1.id, targetCard.id, 'after')
  const afterCards = store.getState().kanbanCards
  const afterIndex1 = afterCards.findIndex(c => c.id === card1.id)
  const afterIndexTarget = afterCards.findIndex(c => c.id === targetCard.id)
  assert.equal(afterIndex1, afterIndexTarget + 1)
})

test('Todo tasks can be reordered by dragging to adjust sprint priorities', () => {
  const store = createDevStoreMock()
  const initial = store.getState().todoTasks
  assert.ok(initial.length >= 2)

  const firstTask = initial[0]
  const secondTask = initial[1]

  // Drag first task after second task
  store.getState().reorderTodoTasks(firstTask.id, secondTask.id, 'after')
  const updated = store.getState().todoTasks
  const idx1 = updated.findIndex(t => t.id === firstTask.id)
  const idx2 = updated.findIndex(t => t.id === secondTask.id)
  assert.equal(idx1, idx2 + 1)

  // Drag second task before first task
  store.getState().reorderTodoTasks(secondTask.id, firstTask.id, 'before')
  const updated2 = store.getState().todoTasks
  const idx2b = updated2.findIndex(t => t.id === secondTask.id)
  const idx1b = updated2.findIndex(t => t.id === firstTask.id)
  assert.equal(idx2b, idx1b - 1)
})

test('Documentation articles can be reordered in the sidebar via drag-and-drop', () => {
  const store = createDevStoreMock()
  const initial = store.getState().devDocs
  assert.ok(initial.length >= 2)

  const doc1 = initial[0]
  const doc2 = initial[1]

  store.getState().reorderDevDocs(doc1.id, doc2.id, 'after')
  const updated = store.getState().devDocs
  const idx1 = updated.findIndex(d => d.id === doc1.id)
  const idx2 = updated.findIndex(d => d.id === doc2.id)
  assert.equal(idx1, idx2 + 1)

  store.getState().reorderDevDocs(doc1.id, doc2.id, 'before')
  const updated2 = store.getState().devDocs
  const idx1b = updated2.findIndex(d => d.id === doc1.id)
  const idx2b = updated2.findIndex(d => d.id === doc2.id)
  assert.equal(idx1b, idx2b - 1)
})
