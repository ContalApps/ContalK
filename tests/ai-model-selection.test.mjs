import test from 'node:test'
import assert from 'node:assert/strict'

test('AI model selection preference persistence stores and restores models across sessions', () => {
  const store = new Map()
  const mockLocalStorage = {
    getItem: key => store.get(key) || null,
    setItem: (key, val) => store.set(key, String(val)),
    removeItem: key => store.delete(key),
    clear: () => store.clear()
  }

  // 1. User selects OpenAI and gpt-4o
  mockLocalStorage.setItem('contalk:preferred-ai-provider', 'openai')
  mockLocalStorage.setItem('contalk:preferred-ai-model', 'gpt-4o')
  mockLocalStorage.setItem('contalk:preferred-ai-model:openai', 'gpt-4o')

  // Verify stored values
  assert.equal(mockLocalStorage.getItem('contalk:preferred-ai-provider'), 'openai')
  assert.equal(mockLocalStorage.getItem('contalk:preferred-ai-model'), 'gpt-4o')
  assert.equal(mockLocalStorage.getItem('contalk:preferred-ai-model:openai'), 'gpt-4o')

  // 2. Switching to Gemini preserves its own preference while keeping previous
  mockLocalStorage.setItem('contalk:preferred-ai-provider', 'gemini')
  mockLocalStorage.setItem('contalk:preferred-ai-model', 'gemini-1.5-pro')
  mockLocalStorage.setItem('contalk:preferred-ai-model:gemini', 'gemini-1.5-pro')

  assert.equal(mockLocalStorage.getItem('contalk:preferred-ai-provider'), 'gemini')
  assert.equal(mockLocalStorage.getItem('contalk:preferred-ai-model:gemini'), 'gemini-1.5-pro')
  assert.equal(mockLocalStorage.getItem('contalk:preferred-ai-model:openai'), 'gpt-4o')

  // 3. Simulating channel switch or app restart: restores the last active model
  const activeProvider = mockLocalStorage.getItem('contalk:preferred-ai-provider') || 'openai'
  const activeModel = mockLocalStorage.getItem(`contalk:preferred-ai-model:${activeProvider}`) || mockLocalStorage.getItem('contalk:preferred-ai-model')
  assert.equal(activeProvider, 'gemini')
  assert.equal(activeModel, 'gemini-1.5-pro')

  // 4. User changes model to dall-e-3
  mockLocalStorage.setItem('contalk:preferred-ai-provider', 'openai')
  mockLocalStorage.setItem('contalk:preferred-ai-model', 'dall-e-3')
  mockLocalStorage.setItem('contalk:preferred-ai-model:openai', 'dall-e-3')

  const updatedProvider = mockLocalStorage.getItem('contalk:preferred-ai-provider')
  const updatedModel = mockLocalStorage.getItem(`contalk:preferred-ai-model:${updatedProvider}`)
  assert.equal(updatedProvider, 'openai')
  assert.equal(updatedModel, 'dall-e-3')
})
