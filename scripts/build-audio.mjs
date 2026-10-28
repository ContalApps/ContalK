import { execFileSync, execSync } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import path from 'node:path'

if (process.platform !== 'win32') throw new Error('O helper de áudio requer Windows e Visual Studio C++ Build Tools.')
if (existsSync('native/bin/contalk-audio.exe') && existsSync('native/bin/contalk-update.exe')) {
  console.log('Helpers nativos já compilados em native/bin.'); process.exit(0)
}
const vswhere = path.join(process.env['ProgramFiles(x86)'] || '', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe')
if (!existsSync(vswhere)) throw new Error('Instale o Visual Studio C++ Build Tools com o Windows SDK.')
const install = execFileSync(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'], { encoding: 'utf8' }).trim()
if (!install) throw new Error('Visual Studio C++ Build Tools não encontrado.')
mkdirSync('native/bin', { recursive: true })
const vcvars = path.join(install, 'VC', 'Auxiliary', 'Build', 'vcvars64.bat')
// All inputs below are fixed paths, not shell/user-provided arguments.
const command = `call "${vcvars}" >nul && cl /nologo /std:c++17 /EHsc /O2 /MT /DUNICODE /D_UNICODE native\\audio-capture\\main.cpp /Fo:native\\bin\\audio-capture.obj /Fe:native\\bin\\contalk-audio.exe /link ole32.lib mmdevapi.lib user32.lib dwmapi.lib /SUBSYSTEM:CONSOLE`
execSync(command, { stdio: 'inherit', shell: process.env.ComSpec || 'cmd.exe' })


const updateCommand = `call "${vcvars}" >nul && cl /nologo /std:c++17 /EHsc /O2 /MT /DUNICODE /D_UNICODE native\\update-progress\\main.cpp /Fo:native\\bin\\update-progress.obj /Fe:native\\bin\\contalk-update.exe /link gdiplus.lib user32.lib gdi32.lib shell32.lib /SUBSYSTEM:WINDOWS`
execSync(updateCommand, { stdio: 'inherit', shell: process.env.ComSpec || 'cmd.exe' })
