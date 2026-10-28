import test from 'node:test'
import assert from 'node:assert/strict'
import { loadTypescript } from './load-typescript.mjs'

test('getCollaboratorColor produces consistent deterministic hex colors for real users', () => {
  const { getCollaboratorColor } = loadTypescript('src/store/useDevCollaborationStore.ts', {
    './useAuthStore': { useAuthStore: { getState: () => ({ user: { username: 'caliari', display_name: 'Caliari' } }) } },
    './useCommunityStore': { useCommunityStore: { getState: () => ({ broadcastDevCursor: async () => {}, broadcastDevCode: async () => {} }) } },
    'zustand': { create: fn => fn(() => {}, () => ({})) }
  })

  const color1 = getCollaboratorColor('caliari')
  const color2 = getCollaboratorColor('caliari')
  assert.equal(color1, color2)
  assert.match(color1, /^#[0-9a-f]{6}$/i)

  const colorVg = getCollaboratorColor('vg')
  assert.match(colorVg, /^#[0-9a-f]{6}$/i)
  assert.notEqual(color1, colorVg)
})
