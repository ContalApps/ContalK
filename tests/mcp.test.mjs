import assert from 'node:assert/strict'
import { test } from 'node:test'
import os from 'node:os'
import fs from 'node:fs'
import path from 'node:path'
import { loadTypescript } from './load-typescript.mjs'

test('MCP manager saves, lists, sanitizes, and removes server configurations', async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'contalk-mcp-test-'))
  const fakeApp = { getPath: (name) => (name === 'userData' ? tmpDir : os.tmpdir()) }
  const fakeElectron = { app: fakeApp, ipcMain: { handle() {}, removeHandler() {} } }

  const { createMcpManager } = loadTypescript(
    'electron/mcp.ts',
    { electron: fakeElectron },
    { process }
  )

  const manager = createMcpManager()

  // Initially empty
  const initial = await manager.listServers()
  assert.equal(initial.length, 0)

  // Reject invalid
  await assert.rejects(manager.saveServer({ name: '', command: 'npx' }), /Nome do servidor MCP é obrigatório/)
  await assert.rejects(manager.saveServer({ name: 'srv', command: '' }), /Comando do servidor MCP é obrigatório/)

  // Save valid server
  await manager.saveServer({
    name: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', 'D:/workspace'],
    disabled: false
  })

  const list = await manager.listServers()
  assert.equal(list.length, 1)
  assert.equal(list[0].name, 'filesystem')
  assert.equal(list[0].command, 'npx')
  assert.equal(list[0].args.length, 3)
  assert.equal(list[0].args[0], '-y')
  assert.equal(list[0].args[1], '@modelcontextprotocol/server-filesystem')
  assert.equal(list[0].args[2], 'D:/workspace')

  // Update existing server
  await manager.saveServer({
    name: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem', 'C:/other'],
    disabled: true
  })

  const updatedList = await manager.listServers()
  assert.equal(updatedList.length, 1)
  assert.equal(updatedList[0].args[2], 'C:/other')
  assert.equal(updatedList[0].disabled, true)

  // Remove server
  await manager.removeServer('filesystem')
  const emptyList = await manager.listServers()
  assert.equal(emptyList.length, 0)

  // Clean up
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  } catch {}
})

test('parseAgentActions correctly parses tool calls in markdown and xml formats', async () => {
  const { parseAgentActions } = loadTypescript('src/components/AgentActionCard.tsx', {
    react: { useState() { return [] } },
    './ControlIcon': { ControlIcon: () => null }
  })

  // Test 1: Code fence with JSON
  const text1 = 'Aqui está a ação para rodar os testes:\n```tool_call\n{\n  "tool": "run_command",\n  "command": "npm test"\n}\n```\nO que acha?'
  const blocks1 = parseAgentActions(text1)
  assert.equal(blocks1.length, 3)
  assert.equal(blocks1[0].type, 'text')
  assert.match(blocks1[0].text, /Aqui está/)
  assert.equal(blocks1[1].type, 'action')
  assert.equal(blocks1[1].action.tool, 'run_command')
  assert.equal(blocks1[1].action.command, 'npm test')
  assert.equal(blocks1[2].type, 'text')
  assert.match(blocks1[2].text, /O que acha/)

  // Test 2: Code fence tool_call:run_command
  const text2 = 'Executando comando:\n```tool_call:run_command\ngit status\n```'
  const blocks2 = parseAgentActions(text2)
  assert.equal(blocks2.length, 2)
  assert.equal(blocks2[1].type, 'action')
  assert.equal(blocks2[1].action.tool, 'run_command')
  assert.equal(blocks2[1].action.command, 'git status')

  // Test 3: XML tag
  const text3 = 'Criando arquivo:\n<agent_action tool="write_file" path="src/test.ts">export const a = 1</agent_action>'
  const blocks3 = parseAgentActions(text3)
  assert.equal(blocks3.length, 2)
  assert.equal(blocks3[1].type, 'action')
  assert.equal(blocks3[1].action.tool, 'write_file')
  assert.equal(blocks3[1].action.path, 'src/test.ts')
  assert.equal(blocks3[1].action.content, 'export const a = 1')
})
