import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EventEmitter } from 'node:events'
import { loadTypescript } from './load-typescript.mjs'
function fixture(){
 let state,focused=false;const storage=new Map()
 const create=init=>{const get=()=>state;const set=patch=>state={...state,...patch};state=init(set,get);return {getState:get}}
 const store=loadTypescript('src/store/useNotificationStore.ts',{zustand:{create}},{localStorage:{getItem:key=>storage.get(key),setItem:(key,value)=>storage.set(key,value)},document:{hasFocus:()=>focused,hidden:false}}).useNotificationStore
 return {store,storage,focus:value=>focused=value}
}
const notice=(id,channel='text')=>({id,kind:'message',title:'Uma pessoa',body:'Olá',channelId:channel,createdAt:Date.now(),read:false})
test('unread counters are deduplicated, persist per account and clear when that channel is read',()=>{
 const f=fixture(),get=f.store.getState;get().activate('alice')
 get().push(notice('one'));get().push(notice('one'));get().push(notice('two'))
 assert.equal(get().unreadByChannel.text,2)
 get().markRead('one');assert.equal(get().unreadByChannel.text,1)
 get().activate('bob');assert.equal(get().entries.length,0)
 get().activate('alice');assert.equal(get().unreadByChannel.text,1)
 f.focus(true);get().setVisibleChannel('text');assert.equal(get().unreadByChannel.text,undefined)
 assert.ok(get().entries.every(entry=>entry.read))
 get().push(notice('other','another'));get().markAllRead();assert.equal(Object.keys(get().unreadByChannel).length,0)
})
test('reading a visible but unfocused channel does not discard unread messages',()=>{
 const f=fixture(),get=f.store.getState;get().activate('alice');get().push(notice('one'));get().setVisibleChannel('text')
 assert.equal(get().unreadByChannel.text,1)
})
test('system notification IPC is limited to the main renderer and opens the correct activity',()=>{
 const ipc=new EventEmitter(),window=new EventEmitter(),notifications=[];let shown=0
 window.webContents={mainFrame:{},isDestroyed:()=>false,send:(...args)=>notifications.push(args)};window.isDestroyed=()=>false
 const created=[]
 class NativeNotification extends EventEmitter{static isSupported(){return true}constructor(value){super();this.value=value;created.push(this)}show(){}close(){this.emit('close')}}
 const {setupNotifications}=loadTypescript('electron/notifications.ts',{electron:{ipcMain:ipc,Notification:NativeNotification},'./single-instance':{showMainWindow:()=>shown++}})
 setupNotifications(window)
 const event={sender:window.webContents,senderFrame:window.webContents.mainFrame}
 ipc.emit('activity-notify',{sender:{},senderFrame:{}},notice('forged'));assert.equal(created.length,0)
 ipc.emit('activity-notify',event,notice('one'));ipc.emit('activity-notify',event,notice('two'));assert.equal(created.length,2)
 created[1].emit('click');assert.equal(shown,1);assert.equal(notifications[0][1],'two')
 window.emit('closed');assert.equal(ipc.listenerCount('activity-notify'),0)
})

test('activity routes messages, friendships and live calls to the center and respects system notification settings',()=>{
 const f=fixture(),sent=[];f.store.getState().activate('alice')
 const observable=initial=>{let state=initial;const listeners=new Set();return {getState:()=>state,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},update:patch=>{const previous=state;state={...state,...patch};for(const listener of listeners)listener(state,previous)}}}
 const auth=observable({user:{username:'alice'}}),app=observable({messages:{},servers:[{channels:[{id:'general',name:'geral'}]}]}),friends=observable({relations:{}}),preferences=observable({systemNotifications:true}),voice=observable({connectionStatus:'connected',activeChannelId:'call',activeChannelName:'Sala',participants:[]})
 const rolesApi=loadTypescript('src/roles/permissions.ts');const policy=rolesApi.initialPolicy('group',['alice','bob']);policy.roles.push({...rolesApi.everyoneRole('team'),position:1,name:'Equipe',permissions:'0'});policy.memberRoles.alice=['team']
 const {setupActivityNotifications}=loadTypescript('src/notifications/activity.ts',{
  '../store/useRoleStore':{useRoleStore:{getState:()=>({snapshot:{policy}})}},'../roles/permissions':rolesApi,'../store/useAuthStore':{useAuthStore:auth},'../store/useAppStore':{useAppStore:app},'../store/useFriendStore':{useFriendStore:friends},'../store/useVoiceStore':{useVoiceStore:voice},'../store/usePreferencesStore':{usePreferencesStore:preferences},'../store/useNotificationStore':{useNotificationStore:f.store},
 },{document:{hasFocus:()=>false,hidden:false,addEventListener(){},removeEventListener(){}},window:{contalkDesktop:{notifyActivity:notice=>sent.push(notice)},addEventListener(){},removeEventListener(){}}})
 const stop=setupActivityNotifications()
 const message={id:'one',userId:'bob',userName:'Bob',content:'Olá'}
 app.update({messages:{general:[message,{id:'mine',userId:'alice',content:'Minha'}]}})
 assert.equal(sent.length,1);assert.equal(sent[0].title,'#geral · Bob');assert.equal(f.store.getState().unreadByChannel.general,1)
 // A replay cannot display a second native notification for an existing notice.
 app.update({messages:{}});app.update({messages:{general:[message]}});assert.equal(sent.length,1)
 friends.update({relations:{bob:{status:'incoming',requestId:'friend-one',display_name:'Bob'}}})
 assert.equal(sent.at(-1).kind,'friendship')
 friends.update({relations:{bob:{status:'friend',requestId:'friend-one',display_name:'Bob'}}})
 assert.equal(sent.at(-1).title,'Amizade confirmada')
 voice.update({participants:[{identity:'bob',name:'Bob',isScreenShareEnabled:false}]})
 assert.equal(sent.at(-1).kind,'voice')
 // Advance the same peer to a live stream: this is a separate event.
 const beforeLive=sent.length
 voice.update({participants:[{identity:'charlie',name:'Charlie',isScreenShareEnabled:true}]})
 assert.equal(sent.length,beforeLive+1);assert.equal(sent.at(-1).kind,'live')
 app.update({messages:{general:[message,{id:'role-ping',userId:'bob',userName:'Bob',content:'<@&team>',roleMentions:['team']}]}});assert.equal(sent.at(-1).mention,true);assert.match(sent.at(-1).body,/@Equipe/);preferences.update({roleMentionNotifications:false});app.update({messages:{general:[message,{id:'muted-role-ping',userId:'bob',userName:'Bob',content:'<@&team>',roleMentions:['team']}]}});assert.equal(sent.at(-1).mention,false)
 preferences.update({systemNotifications:false});const before=sent.length
 app.update({messages:{general:[message,{id:'private',userId:'bob',userName:'Bob',once:true,content:'Conteúdo privado'}]}})
 assert.equal(sent.length,before);assert.equal(f.store.getState().entries[0].body,'Mensagem de visualização única')
 stop();app.update({messages:{general:[{id:'after-stop',userId:'bob',content:'fim'}]}})
 assert.equal(f.store.getState().entries.some(entry=>entry.id==='message:after-stop'),false)
})
