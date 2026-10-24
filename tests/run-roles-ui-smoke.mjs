// Opt-in: the actual Electron bridge and editor talk to an isolated HTTP service.
import { build } from 'esbuild'
import { spawn, execFileSync } from 'node:child_process'
import { once } from 'node:events'
import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { createCommunityService, createCommunityState } from '../scripts/community/service.mjs'

const folder='release/roles-ui-smoke'
fs.mkdirSync(folder,{recursive:true})
for(const name of ['contalk-avatar.png','contalk-logo.png'])fs.copyFileSync('public/'+name,folder+'/'+name)
const keys={alice:randomBytes(32).toString('hex'),bob:randomBytes(32).toString('hex')}
const initialState=createCommunityState(['alice','bob'])
initialState.servers['srv-1'].messages['ch-general']=Array.from({length:120},(_,index)=>({id:'history-'+index,channelId:'ch-general',userId:'bob',userName:'Bob',content:'Histórico '+index,timestamp:index}))
const service=createCommunityService({tokens:{[keys.alice]:'alice',[keys.bob]:'bob'},initialState})
service.server.listen(0,'127.0.0.1');await once(service.server,'listening')
const endpoint='http://127.0.0.1:'+service.server.address().port
try{
 await build({entryPoints:['electron/community.ts'],bundle:true,platform:'node',format:'cjs',external:['electron'],outfile:folder+'/community.cjs'})
 const renderer=`
import React from 'react';import {createRoot} from 'react-dom/client';import {RoleManager} from './src/components/RoleManager';import {useRoleStore} from './src/store/useRoleStore';import './src/roles.css';
import {ConTALKLayout} from './src/components/ConTALKLayout';import {useAuthStore} from './src/store/useAuthStore';import {useAppStore} from './src/store/useAppStore';import {useCommunityStore} from './src/store/useCommunityStore';import {useVoiceStore} from './src/store/useVoiceStore';import {setupCentralCommunity} from './src/roles/runtime';
const pause=()=>new Promise(resolve=>setTimeout(resolve,80));
const check=(value,message)=>{if(!value)throw new Error(message)};
const button=text=>[...document.querySelectorAll('button')].find(element=>element.textContent.trim()===text);
const input=(selector,value)=>{const element=document.querySelector(selector);check(element,'input exists: '+selector);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(element,value);element.dispatchEvent(new Event('input',{bubbles:true}));};
const ready=async(predicate,label)=>{const deadline=Date.now()+6000;while(Date.now()<deadline){if(predicate())return;await pause()}throw new Error('Timeout: '+label)};
const role=()=>useRoleStore.getState().snapshot.policy.roles.find(item=>item.name==='Equipe');
(async()=>{try{
 await window.contalkDesktop.configureCommunity(${JSON.stringify({url:endpoint,token:keys.alice})});
 await useRoleStore.getState().activate('alice');
 await ready(()=>useRoleStore.getState().status==='connected','initial snapshot');
 const root=createRoot(document.getElementById('root'));root.render(<div className="ct-app" data-theme="classic"><RoleManager onClose={()=>{}}/></div>);await pause();
 input('[aria-label="Nome do novo cargo"]','Equipe');await pause();button('Criar cargo').click();
 await ready(()=>role(),'role creation');await pause();
 input('[aria-label="Nome do cargo"]','Equipe');input('[aria-label="Cor do cargo"]','#8866ee');await pause();
 const iconBytes=Uint8Array.from(atob(${JSON.stringify(fs.readFileSync('public/app-icon.png').toString('base64'))}),character=>character.charCodeAt(0));const iconTransfer=new DataTransfer();iconTransfer.items.add(new File([iconBytes],'role.png',{type:'image/png'}));const iconPicker=document.querySelector('[aria-label="Imagem do ícone do cargo"]');iconPicker.files=iconTransfer.files;iconPicker.dispatchEvent(new Event('change',{bubbles:true}));await ready(()=>document.querySelector('.ct-role-editor>header img'),'image icon preview');
 const hoist=[...document.querySelectorAll('.ct-role-check input')][0];hoist.click();await pause();
 button('Salvar cargo').click();await ready(()=>role().color==='#8866ee'&&role().hoist,'saved appearance');
 check(role().icon.startsWith('data:image/webp;base64,'),'image icon is resized and saved in the central role');
 const second=await window.diag.otherSnapshot();check(second.policy.roles.some(item=>item.name==='Equipe'&&item.color==='#8866ee'),'another authenticated client observes saved role');
 button('Permissões').click();await pause();input('[aria-label="Buscar permissão"]','Anexar arquivos');await pause();document.querySelector('[aria-label="Anexar arquivos"]').click();await pause();button('Salvar cargo').click();
 await ready(()=>BigInt(role().permissions)>0n,'saved permissions');
 button('Membros').click();await pause();document.querySelector('[aria-label="Atribuir Equipe a bob"]').click();
 await ready(()=>useRoleStore.getState().snapshot.policy.memberRoles.bob?.includes(role().id),'saved assignment');
 await window.diag.capture('assigned-role');
 button('Aparência').click();await pause();input('[aria-label="Nome do cargo"]','Meu rascunho');await pause();
 await window.diag.remoteRename(role().id,'Equipe remota');await ready(()=>document.querySelector('.ct-role-warning'),'concurrent edit warning');
 check(document.querySelector('[aria-label="Nome do cargo"]').value==='Meu rascunho','remote changes preserve unsaved input');check(button('Salvar cargo').disabled,'stale edits cannot silently overwrite another client');
 button('Carregar versão atual').click();await pause();check(document.querySelector('[aria-label="Nome do cargo"]').value==='Equipe remota','explicit reload uses current revision');
 button('Excluir cargo…').click();await pause();check(document.querySelector('[role="alertdialog"]'),'deletion has a separate confirmation');button('Cancelar').click();await pause();check(useRoleStore.getState().snapshot.policy.roles.length===2,'cancel preserves role');
 button('Excluir cargo…').click();await pause();button('Excluir cargo').click();await ready(()=>useRoleStore.getState().snapshot.policy.roles.length===1,'delete role');
 check(!useRoleStore.getState().snapshot.policy.memberRoles.bob.length,'deleting role removes assignments');
 button('Auditoria').click();await pause();check(document.querySelector('.ct-role-audit').textContent.includes('Cargo excluído'),'audit records actual actions');
 await window.diag.capture('audit');
 useAuthStore.setState({user:{id:'alice',username:'alice',display_name:'Alice',email:'alice@invalid.local'},isAuthenticated:true});
 useCommunityStore.setState({connect:async()=>{},disconnect:()=>{},status:'online',members:[{username:'alice',display_name:'Alice',online:true},{username:'bob',display_name:'Bob',online:true}]});useVoiceStore.setState({fetchChannelOccupants:async()=>{}});
 const stopCentral=setupCentralCommunity();root.render(<ConTALKLayout/>);await pause();document.querySelector('[title="ConTALK HQ"]').click();await pause();document.querySelector('[title="geral"]').click();await pause();
 check(document.querySelector('.ct-activity').getBoundingClientRect().width>0,'member column is still accessible at a narrower window width');
 document.querySelector('.ct-messages').scrollTop=0;button('Carregar mensagens anteriores').click();await ready(()=>useAppStore.getState().messages['ch-general']?.[0]?.id==='history-0','older history loads into the real chat');await pause();check(document.querySelector('.ct-messages').scrollTop<document.querySelector('.ct-messages').scrollHeight-document.querySelector('.ct-messages').clientHeight-50,'history pagination does not jump back to the latest message');
 input('[aria-label="Mensagem"]','Mensagem pelo serviço central');await pause();document.querySelector('.ct-composer').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
 await ready(()=>document.querySelector('.ct-messages').textContent.includes('Mensagem pelo serviço central'),'central message appears in the application');
 check((await window.diag.otherSnapshot()).messages['ch-general'].some(message=>message.content==='Mensagem pelo serviço central'&&message.userId==='alice'),'app message is authenticated and stored centrally');
 check(!localStorage.getItem('contalk-community-v2').includes('Mensagem pelo serviço central'),'central history is excluded from the shared local cache');
 document.querySelector('[aria-label="Configurações de geral"]').click();await pause();button('Permissões').click();await pause();document.querySelector('[aria-label="Enviar mensagens: Negar"]').click();await pause();button('Salvar permissões').click();
 await ready(()=>useRoleStore.getState().snapshot.policy.overwrites['ch-general']?.some(item=>BigInt(item.deny)>0n),'channel overwrite saved centrally');
 document.querySelector('[aria-label="Fechar configurações do canal"]').click();await pause();document.querySelector('[aria-label="Gerenciar cargos do servidor"]').click();await pause();button('Ver como cargos').click();await pause();
 check([...document.querySelectorAll('.ct-role-preview .ct-role-member')].some(item=>item.textContent.includes('geral')&&item.textContent.includes('Somente leitura')),'role preview applies overwrites without owner privileges');
 await window.diag.capture('app-channel-preview');button('Categorias').click();await pause();input('[aria-label="Nome da nova categoria"]','Equipe de testes');await pause();button('Criar categoria').click();await ready(()=>useRoleStore.getState().snapshot.policy.categories.length===1,'category creation');await pause();
 document.querySelector('[aria-label="Enviar mensagens: Negar"]').click();await pause();button('Salvar permissões').click();await ready(()=>Object.keys(useRoleStore.getState().snapshot.policy.overwrites).length===2,'category overwrite');
 document.querySelector('[aria-label="Fechar cargos"]').click();await pause();document.querySelector('[aria-label="Configurações de geral"]').click();await pause();button('Permissões').click();await pause();const categorySelect=document.querySelector('[aria-label="Categoria do canal"]');categorySelect.value=useRoleStore.getState().snapshot.policy.categories[0].id;categorySelect.dispatchEvent(new Event('change',{bubbles:true}));await ready(()=>useRoleStore.getState().snapshot.policy.channelCategories['ch-general'],'category association');await pause();button('Sincronizar com categoria').click();await ready(()=>useRoleStore.getState().snapshot.policy.channelCategories['ch-general'].synced,'category synchronization');document.querySelector('[aria-label="Fechar configurações do canal"]').click();await pause();
 await useRoleStore.getState().command({type:'role',command:{type:'create',id:'debate',name:'Debate'}});await useRoleStore.getState().command({type:'role',command:{type:'edit',id:'debate',patch:{color:'#ff6600',hoist:true,mentionable:true,icon:'⭐'}}});await pause();
 const bob=[...document.querySelectorAll('.ct-activity-person')].find(item=>item.textContent.includes('Bob'));bob.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,clientX:900,clientY:200}));await pause();button('Cargos do membro').click();await pause();document.querySelector('[aria-label="Debate para bob"]').click();await ready(()=>useRoleStore.getState().snapshot.policy.memberRoles.bob?.includes('debate'),'member context role assignment');document.querySelector('[aria-label="Fechar cargos do membro"]').click();await pause();
 check(document.querySelector('.ct-role-group-label').textContent.includes('Debate'),'hoisted role creates a member group');check([...document.querySelectorAll('.ct-activity-person .ct-role-badge')].some(item=>getComputedStyle(item).color==='rgb(255, 102, 0)'),'role color appears on member name');
 const mention=document.querySelector('[aria-label="Mencionar pessoa"]');mention.value='role:debate';mention.dispatchEvent(new Event('change',{bubbles:true}));await pause();document.querySelector('.ct-composer').dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));await ready(()=>document.querySelector('[aria-label="Menção ao cargo Debate"]'),'trusted role mention renders by role name');
 await window.diag.capture('member-role-and-mention');
 stopCentral();root.unmount();await useRoleStore.getState().activate(null);
 window.diag.result({ok:true,checks:['real-encrypted-electron-configuration','authenticated-http-sse','create-role','appearance-and-permissions','multi-client-role-sync','assign-role','concurrent-edit-preserves-draft','separate-delete-confirmation','delete-cleans-assignments','server-audit','real-app-central-message','private-data-excluded-from-legacy-cache','channel-permission-editor','owner-safe-role-preview','category-permissions-and-sync','member-context-role-assignment','hoisted-member-groups','role-name-color','trusted-role-mention','history-pages-without-scroll-jump','member-column-remains-accessible']});
}catch(error){window.diag.result({ok:false,error:error.message,stack:error.stack})}})();
`
 await build({stdin:{contents:renderer,resolveDir:process.cwd(),loader:'tsx'},bundle:true,platform:'browser',format:'iife',define:{'import.meta.env.VITE_APP_VERSION':JSON.stringify(JSON.parse(fs.readFileSync('package.json','utf8')).version)},outfile:folder+'/renderer.js'})
 const css=fs.readFileSync('dist/index.html','utf8').match(/assets\/([^"\s]+\.css)/)[1]
 fs.writeFileSync(folder+'/index.html',`<!doctype html><html><head><link rel="stylesheet" href="../../dist/assets/${css}"><link rel="stylesheet" href="renderer.css"></head><body><div id="root"></div><script src="renderer.js"></script></body></html>`)
 fs.writeFileSync(folder+'/preload.cjs',`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('contalkDesktop',{communityStatus:()=>ipcRenderer.invoke('community-status'),configureCommunity:v=>ipcRenderer.invoke('community-configure',v),communityCommand:(...args)=>ipcRenderer.invoke('community-command',...args),communitySnapshot:id=>ipcRenderer.invoke('community-snapshot',id),communityHistory:(...args)=>ipcRenderer.invoke('community-history',...args),subscribeCommunity:id=>ipcRenderer.invoke('community-subscribe',id),unsubscribeCommunity:()=>ipcRenderer.invoke('community-unsubscribe'),onCommunityState:listener=>{const handler=(_,value)=>listener(value);ipcRenderer.on('community-state',handler);return()=>ipcRenderer.removeListener('community-state',handler)}});contextBridge.exposeInMainWorld('diag',{otherSnapshot:()=>ipcRenderer.invoke('diag-other'),remoteRename:(...args)=>ipcRenderer.invoke('diag-rename',...args),capture:name=>ipcRenderer.invoke('diag-capture',name),result:value=>ipcRenderer.send('diag-result',value)});`)
 fs.writeFileSync(folder+'/main.cjs',`const {app,BrowserWindow,ipcMain}=require('electron');const fs=require('fs'),path=require('path');const {setupCommunity}=require('./community.cjs');app.setPath('userData',path.join(__dirname,'profile'));const endpoint=${JSON.stringify(endpoint)},token=${JSON.stringify(keys.bob)};const get=async()=>{const response=await fetch(endpoint+'/servers/srv-1',{headers:{Authorization:'Bearer '+token}});return response.json()};ipcMain.handle('diag-other',get);ipcMain.handle('diag-rename',async(_,id,name)=>{const snapshot=await get();const response=await fetch(endpoint+'/servers/srv-1/commands',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({revision:snapshot.revision,action:{type:'role',command:{type:'edit',id,patch:{name}}}})});if(!response.ok)throw new Error('Remote rename failed');return response.json()});let win;const timeout=setTimeout(()=>app.exit(1),35000);ipcMain.handle('diag-capture',async(_,name)=>{await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true});await new Promise(resolve=>setTimeout(resolve,200));fs.writeFileSync(path.join(__dirname,name+'.png'),(await win.webContents.capturePage(undefined,{stayHidden:true,stayAwake:true})).toPNG())});ipcMain.on('diag-result',(_,value)=>{clearTimeout(timeout);fs.writeFileSync(path.join(__dirname,'result.json'),JSON.stringify(value,null,2));console.log(JSON.stringify(value));win.destroy();app.exit(value.ok?0:1)});app.whenReady().then(()=>{win=new BrowserWindow({width:1100,height:820,show:false,webPreferences:{partition:'roles-'+Date.now(),preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});setupCommunity(win,()=> 'alice');win.loadFile(path.join(__dirname,'index.html'))});`)
 const electron=process.env.ELECTRON_PATH||execFileSync(process.execPath,['-e',"process.stdout.write(require('electron'))"],{encoding:'utf8'}).trim()
 const env={...process.env};delete env.ELECTRON_RUN_AS_NODE
 const child=spawn(electron,[path.join(folder,'main.cjs')],{windowsHide:true,stdio:'inherit',env})
 const timeout=setTimeout(()=>child.kill(),45000)
 try{const [code]=await once(child,'exit');if(code!==0)throw new Error('Role editor smoke failed: '+code)}finally{clearTimeout(timeout)}
}finally{service.server.closeAllConnections();await new Promise(resolve=>service.server.close(resolve))}
