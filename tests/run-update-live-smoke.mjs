// Opt-in Windows integration test: installs TWO versions of a separate fixture
// application with its own appId, executable, shortcut, userData and directory.
// Never runs as part of npm test. No production installer or user profile is used.
import { build } from 'esbuild'
import { execFileSync, spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import http from 'node:http'
import assert from 'node:assert/strict'

if(process.platform!=='win32')throw new Error('This test requires Windows.')
const require=createRequire(import.meta.url),workspace=process.cwd()
const testRoot=fs.mkdtempSync(path.join(os.tmpdir(),'contalk-update-smoke-'))
if(/\s/.test(testRoot))throw new Error('Use a Windows TEMP directory without spaces for the NSIS /D test argument.')
const installed=path.join(testRoot,'installed'),profile=path.join(testRoot,'profile'),eventsFile=path.join(testRoot,'events.jsonl')
const buildRoot=path.join(workspace,'release','update-live-smoke'),project=path.join(buildRoot,'project'),nextOutput=path.join(buildRoot,'new')
fs.mkdirSync(path.join(project,'dist-electron'),{recursive:true})
fs.cpSync(path.join(workspace,'dist'),path.join(project,'dist'),{recursive:true})
if(!fs.existsSync(path.join(project,'node_modules')))fs.symlinkSync(path.join(workspace,'node_modules'),path.join(project,'node_modules'),'junction')
const server=http.createServer((request,response)=>{
  const name=path.basename(new URL(request.url,'http://localhost').pathname)
  if(!['latest.yml','ConTALKUpdateSmoke-1.0.1.exe','ConTALKUpdateSmoke-1.0.1.exe.blockmap'].includes(name)){response.writeHead(404);response.end();return}
  const file=path.join(nextOutput,name)
  if(!fs.existsSync(file)){response.writeHead(404);response.end();return}
  const size=fs.statSync(file).size,range=/^bytes=(\d+)-(\d*)$/.exec(request.headers.range||'')
  if(range){const start=Number(range[1]),end=range[2]?Number(range[2]):size-1;if(start>end||end>=size){response.writeHead(416);response.end();return}response.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});fs.createReadStream(file,{start,end}).pipe(response)}
  else{response.writeHead(200,{'Content-Length':size});fs.createReadStream(file).pipe(response)}
})
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
const feed=`http://127.0.0.1:${server.address().port}`
const pkg=JSON.parse(fs.readFileSync('package.json','utf8'))
const appId='com.contalk.update-smoke',productName='ConTALKUpdateSmoke'
assert.notEqual(appId,pkg.build.appId)
assert.notEqual(productName,pkg.build.productName)
await build({entryPoints:['electron/main.ts'],bundle:true,platform:'node',format:'esm',packages:'external',outfile:path.join(project,'dist-electron','app-main.js')})
fs.copyFileSync('dist-electron/preload.mjs',path.join(project,'dist-electron','preload.mjs'))
const wrapper=`
import {app} from 'electron';import fs from 'node:fs';import {createRequire} from 'node:module';
const eventFile=${JSON.stringify(eventsFile)};
const record=(event,detail)=>fs.appendFileSync(eventFile,JSON.stringify({event,version:app.getVersion(),detail,at:Date.now()})+'\\n');
app.setPath('userData',${JSON.stringify(profile)});
// Host AppData may be virtualized; keep the fixture's cache isolated as well.
process.env.LOCALAPPDATA=${JSON.stringify(path.join(testRoot,'cache'))};
process.on('uncaughtException',error=>{record('uncaughtException',error.stack);app.exit(1)});
process.on('unhandledRejection',error=>{record('unhandledRejection',String(error));app.exit(1)});
const require=createRequire(import.meta.url),{autoUpdater}=require('electron-updater');
autoUpdater.setFeedURL({provider:'generic',url:${JSON.stringify(feed)}});
autoUpdater.disableDifferentialDownload=true;
let mainWindow,downloading=false;
app.on('browser-window-created',(_,window)=>{
  if(mainWindow)return;mainWindow=window;
  window.on('show',()=>window.hide());window.hide();
  window.webContents.once('did-finish-load',()=>{
    record('loaded');
    if(app.getVersion()==='1.0.1')setTimeout(()=>{record('updated-ready');app.quit()},800);
  });
});
autoUpdater.on('update-downloaded',()=>{downloading=true;record('downloaded')});
autoUpdater.on('error',error=>record('updater-error',error.message));
autoUpdater.on('update-available',()=>setTimeout(()=>{
  record('available');
  mainWindow.webContents.executeJavaScript('window.contalkDesktop.downloadUpdate()').catch(error=>{if(!downloading)record('download-failed',error.message)});
},200));
await import('./app-main.js');
`
fs.writeFileSync(path.join(project,'dist-electron','smoke-main.mjs'),wrapper)
const config={appId,productName,electronVersion:'33.2.0',electronDist:path.join(workspace,'release','electron-runtime'),npmRebuild:false,files:['dist','dist-electron'],win:{target:['nsis'],icon:path.join(workspace,'src-tauri','icons','icon.ico')},nsis:{oneClick:true,createDesktopShortcut:false,createStartMenuShortcut:false,include:path.join(workspace,'build','installer.nsh')},extraResources:pkg.build.extraResources.map(resource=>({...resource,from:path.join(workspace,resource.from)})),directories:{buildResources:path.join(workspace,'build')},artifactName:'ConTALKUpdateSmoke-${version}.${ext}',publish:[{provider:'generic',url:feed}]}
const configFile=path.join(buildRoot,'builder.json'),builder=require.resolve('electron-builder/out/cli/cli.js')
fs.writeFileSync(configFile,JSON.stringify(config))
const env={...process.env,ELECTRON_BUILDER_CACHE:path.join(workspace,'release','build-cache')};delete env.ELECTRON_RUN_AS_NODE
fs.writeFileSync(path.join(buildRoot,'fixture.json'),JSON.stringify({testRoot,installed,profile,eventsFile},null,2))
const logs=[]
let success=false
try{
  for(const [version,directory]of [['1.0.0','old'],['1.0.1','new']]){
    fs.writeFileSync(path.join(project,'package.json'),JSON.stringify({name:'contalk-update-smoke',version,type:'module',main:'dist-electron/smoke-main.mjs',private:true,dependencies:pkg.dependencies}))
    console.log('Building isolated update fixture',version)
    const output=execFileSync(process.execPath,[builder,'--projectDir',project,'--config',configFile,'--config.directories.output='+path.join(buildRoot,directory),'--win','--publish','never'],{encoding:'utf8',windowsHide:true,env})
    logs.push(output)
  }
  const oldInstaller=path.join(buildRoot,'old','ConTALKUpdateSmoke-1.0.0.exe')
  console.log('Installing fixture in',installed)
  execFileSync(oldInstaller,['/S','/D='+installed],{windowsHide:true,timeout:60000,env})
  const executable=path.join(installed,'ConTALKUpdateSmoke.exe')
  assert.ok(fs.existsSync(executable),'fixture must be installed only in the isolated directory')
  const child=spawn(executable,[],{windowsHide:true,stdio:'ignore',env})
  child.on('error',error=>{throw error})
  console.log('Waiting for automatic update and relaunch')
  const deadline=Date.now()+100000
  let events=[]
  while(Date.now()<deadline){
    await new Promise(resolve=>setTimeout(resolve,500))
    if(fs.existsSync(eventsFile))events=fs.readFileSync(eventsFile,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line))
    const failure=events.find(event=>['uncaughtException','unhandledRejection','updater-error','download-failed'].includes(event.event))
    if(failure)throw new Error(JSON.stringify(failure))
    if(events.some(event=>event.event==='updated-ready'&&event.version==='1.0.1')){
      assert.ok(events.some(event=>event.event==='loaded'&&event.version==='1.0.0'))
      assert.ok(events.some(event=>event.event==='downloaded'&&event.version==='1.0.0'))
      const result={ok:true,isolatedAppId:appId,from:'1.0.0',to:'1.0.1',realInstaller:true,realRelaunch:true,events}
      fs.writeFileSync(path.join(buildRoot,'result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));success=true;break
    }
  }
  if(!success)throw new Error('Automatic update did not complete before timeout: '+JSON.stringify(events))
}finally{
  server.close()
  fs.writeFileSync(path.join(buildRoot,'build.log'),logs.join('\n'))
  if(fs.existsSync(eventsFile))fs.copyFileSync(eventsFile,path.join(buildRoot,'events.jsonl'))
  const uninstaller=path.join(installed,'Uninstall ConTALKUpdateSmoke.exe')
  if(path.resolve(uninstaller).startsWith(path.resolve(testRoot)+path.sep)&&fs.existsSync(uninstaller)){
    try{execFileSync(uninstaller,['/S'],{windowsHide:true,timeout:30000,env})}catch(error){console.error('Fixture cleanup needs review:',error.message)}
  }
  // Retain the temporary directory on failure for diagnosis; never remove paths
  // derived from app metadata or uninstall registry values.
  if(success&&fs.realpathSync(path.dirname(testRoot))===fs.realpathSync(os.tmpdir())&&path.basename(testRoot).startsWith('contalk-update-smoke-')){
    await new Promise(resolve=>setTimeout(resolve,1500));fs.rmSync(testRoot,{recursive:true,force:true})
  }
}
