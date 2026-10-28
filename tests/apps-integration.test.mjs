import assert from 'node:assert/strict'
import { test } from 'node:test'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypescript } from './load-typescript.mjs'

test('Apps integration handles Google Workspace and GitHub tools correctly', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contalk-apps-test-'))
  const fakeApp = { getPath: (name) => (name === 'userData' ? tmpDir : os.tmpdir()) }
  const fakeElectron = { app: fakeApp, ipcMain: { handle() {}, removeHandler() {} } }

  const {
    BUILTIN_GOOGLE_TOOLS,
    BUILTIN_GITHUB_TOOLS,
    BUILTIN_BROWSER_TOOLS,
    executeBuiltinTool,
    readAppsConfig,
    writeAppsConfig
  } = loadTypescript(
    'electron/apps-integration.ts',
    { electron: fakeElectron },
    { process }
  )

  // 1. Verify Tool Schemas
  assert.ok(Array.isArray(BUILTIN_GOOGLE_TOOLS))
  assert.ok(BUILTIN_GOOGLE_TOOLS.some(t => t.name === 'gmail_list_messages'))
  assert.ok(BUILTIN_GOOGLE_TOOLS.some(t => t.name === 'youtube_list_subscriptions'))
  assert.ok(BUILTIN_GOOGLE_TOOLS.some(t => t.name === 'calendar_list_events'))
  assert.ok(BUILTIN_GOOGLE_TOOLS.some(t => t.name === 'drive_list_files'))

  assert.ok(Array.isArray(BUILTIN_GITHUB_TOOLS))
  assert.ok(BUILTIN_GITHUB_TOOLS.some(t => t.name === 'github_list_issues'))
  assert.ok(BUILTIN_GITHUB_TOOLS.some(t => t.name === 'github_list_prs'))

  assert.ok(Array.isArray(BUILTIN_BROWSER_TOOLS))
  assert.ok(BUILTIN_BROWSER_TOOLS.some(t => t.name === 'browser_open'))
  assert.ok(BUILTIN_BROWSER_TOOLS.some(t => t.name === 'browser_navigate'))
  assert.ok(BUILTIN_BROWSER_TOOLS.some(t => t.name === 'browser_click'))
  assert.ok(BUILTIN_BROWSER_TOOLS.some(t => t.name === 'browser_type'))
  assert.ok(BUILTIN_BROWSER_TOOLS.some(t => t.name === 'browser_read_content'))
  assert.ok(BUILTIN_BROWSER_TOOLS.some(t => t.name === 'browser_screenshot'))
  assert.ok(BUILTIN_BROWSER_TOOLS.some(t => t.name === 'browser_scroll'))

  // 2. Read and Write Config
  const initialConfig = await readAppsConfig()
  assert.ok(initialConfig.google)
  assert.equal(initialConfig.google.connected, true)

  await writeAppsConfig({
    google: {
      ...initialConfig.google,
      email: 'teste@gmail.com',
      enabledServices: { gmail: true, youtube: true, calendar: false, drive: true }
    }
  })
  const updatedConfig = await readAppsConfig()
  assert.equal(updatedConfig.google.email, 'teste@gmail.com')
  assert.equal(updatedConfig.google.enabledServices.calendar, false)

  // 3. Test Gmail Tool Execution
  const gmailRes = await executeBuiltinTool('google', 'gmail_list_messages', { maxResults: 3 })
  assert.ok(gmailRes)
  assert.ok(Array.isArray(gmailRes.messages))
  assert.ok(gmailRes.messages.length <= 3)
  assert.ok(gmailRes.messages[0].subject)
  assert.ok(gmailRes.messages[0].from)

  const gmailMsg = await executeBuiltinTool('google', 'gmail_get_message', { messageId: 'msg_gm_01' })
  assert.ok(gmailMsg)
  assert.ok(gmailMsg.body.includes('Pull Request'))

  // 4. Test YouTube Tool Execution
  const ytRes = await executeBuiltinTool('google', 'youtube_list_subscriptions', { maxResults: 4 })
  assert.ok(ytRes)
  assert.ok(Array.isArray(ytRes.channels))
  assert.ok(ytRes.channels.length <= 4)
  assert.ok(ytRes.channels[0].title)

  const ytSearch = await executeBuiltinTool('google', 'youtube_search_videos', { query: 'react' })
  assert.ok(ytSearch)
  assert.ok(Array.isArray(ytSearch.videos))
  assert.ok(ytSearch.videos.length > 0)

  // 5. Test Google Calendar Tool Execution
  const calRes = await executeBuiltinTool('google', 'calendar_list_events', { maxResults: 3 })
  assert.ok(calRes)
  assert.ok(Array.isArray(calRes.events))
  assert.ok(calRes.events.length <= 3)
  assert.ok(calRes.events[0].summary)

  // 6. Test Google Drive Tool Execution
  const driveRes = await executeBuiltinTool('google', 'drive_list_files', { maxResults: 5 })
  assert.ok(driveRes)
  assert.ok(Array.isArray(driveRes.files))
  assert.ok(driveRes.files[0].name)

  // 7. Test GitHub Tool Execution
  const ghIssues = await executeBuiltinTool('github', 'github_list_issues', {})
  assert.ok(ghIssues)
  assert.ok(Array.isArray(ghIssues.issues))

  const ghPrs = await executeBuiltinTool('github', 'github_list_prs', {})
  assert.ok(ghPrs)
  assert.ok(Array.isArray(ghPrs.prs))

  // 8. Test Browser Tool Execution
  const bOpen = await executeBuiltinTool('browser', 'browser_open', { url: 'https://example.com' })
  assert.ok(bOpen)

  const bNav = await executeBuiltinTool('browser', 'browser_navigate', { url: 'https://example.com/docs' })
  assert.ok(bNav)
  assert.equal(bNav.success, true)

  const bClick = await executeBuiltinTool('browser', 'browser_click', { selector: 'button.login' })
  assert.ok(bClick)
  assert.equal(bClick.success, true)

  const bType = await executeBuiltinTool('browser', 'browser_type', { selector: 'input[name=q]', text: 'contalk' })
  assert.ok(bType)
  assert.equal(bType.success, true)
  assert.equal(bType.value, 'contalk')

  const bContent = await executeBuiltinTool('browser', 'browser_read_content', {})
  assert.ok(bContent)
  assert.ok(bContent.title)
  assert.ok(bContent.content)
  assert.ok(Array.isArray(bContent.links))

  const bSnap = await executeBuiltinTool('browser', 'browser_screenshot', {})
  assert.ok(bSnap)
  assert.ok(bSnap.src)

  const bScroll = await executeBuiltinTool('browser', 'browser_scroll', { direction: 'down', amount: 300 })
  assert.ok(bScroll)
  assert.equal(bScroll.success, true)
})
