import {execFileSync} from 'node:child_process'
import {existsSync,mkdirSync} from 'node:fs'
import path from 'node:path'

if(process.platform!=='win32')throw new Error('O atalho global requer Windows.')
const compiler=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET','Framework64','v4.0.30319','csc.exe')
if(!existsSync(compiler))throw new Error('Instale o .NET Framework 4 para compilar o componente de voz.')
const assemblies=path.join(process.env.WINDIR||'C:/Windows','Microsoft.NET','assembly','GAC_MSIL')
const speech=path.join(assemblies,'System.Speech','v4.0_4.0.0.0__31bf3856ad364e35','System.Speech.dll')
if(!existsSync(speech))throw new Error('Instale os componentes completos do .NET Framework 4, incluindo System.Speech.')
mkdirSync('native/bin',{recursive:true})
execFileSync(compiler,['/nologo','/target:exe','/platform:x64','/optimize+','/reference:'+speech,'/out:'+path.resolve('native/bin/contalk-voice-input.exe'),path.resolve('native/voice-input/Program.cs')],{stdio:'inherit',windowsHide:true})
