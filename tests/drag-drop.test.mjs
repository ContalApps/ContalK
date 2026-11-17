import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'

test('uploadDroppedFile uses desktop registration and storage upload when running in desktop app', async () => {
  let registeredPath = ''
  let uploadedId = ''
  let statusChecked = false

  const mockDesktop = {
    storageStatus: async () => {
      statusChecked = true
      return true
    },
    getPathForFile: (file) => file._path || '',
    registerDroppedFile: async (filePath) => {
      registeredPath = filePath
      return { id: 'reg-123', name: 'video.mp4', size: 10000000, type: 'video/mp4' }
    },
    uploadStorageFile: async (id) => {
      uploadedId = id
      return { name: 'video.mp4', size: 10000000, type: 'video/mp4', data: '', storageId: 'store-uuid-456' }
    },
  }

  const { uploadDroppedFile } = loadTypescript('src/utils/dropUpload.ts', {}, {
    window: { contalkDesktop: mockDesktop },
  })

  const dummyFile = {
    name: 'video.mp4',
    size: 10000000,
    type: 'video/mp4',
    _path: 'C:\\Users\\test\\Videos\\video.mp4',
  }

  const result = await uploadDroppedFile(dummyFile)
  assert.equal(statusChecked, true)
  assert.equal(registeredPath, 'C:\\Users\\test\\Videos\\video.mp4')
  assert.equal(uploadedId, 'reg-123')
  assert.equal(result.storageId, 'store-uuid-456')
  assert.equal(result.name, 'video.mp4')
})

test('uploadDroppedFile rejects files over 1 MB in web environment without desktop bridge', async () => {
  const { uploadDroppedFile } = loadTypescript('src/utils/dropUpload.ts', {}, {
    window: {},
  })

  const largeFile = {
    name: 'huge.iso',
    size: 50 * 1024 * 1024,
    type: 'application/octet-stream',
  }

  await assert.rejects(
    uploadDroppedFile(largeFile),
    /excede o limite de 1 MB/
  )
})

test('uploadDroppedFile reads small file via FileReader in web environment', async () => {
  class MockFileReader {
    readAsDataURL(file) {
      setTimeout(() => {
        this.result = 'data:text/plain;base64,SGVsbG8gV29ybGQ='
        this.onload()
      }, 5)
    }
  }

  const { uploadDroppedFile } = loadTypescript('src/utils/dropUpload.ts', {}, {
    window: {},
    FileReader: MockFileReader,
  })

  const smallFile = {
    name: 'hello.txt',
    size: 11,
    type: 'text/plain',
  }

  const result = await uploadDroppedFile(smallFile)
  assert.equal(result.name, 'hello.txt')
  assert.equal(result.size, 11)
  assert.equal(result.type, 'text/plain')
  assert.ok(result.data.startsWith('data:application/octet-stream;base64,'))
})
