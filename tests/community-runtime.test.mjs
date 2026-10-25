import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'

test('activating or replacing the VPS connection releases an old voice session without interrupting it on ordinary role updates',()=>{
  const observable=initial=>{
    let state=initial;const listeners=new Set()
    const store={getState:()=>state,subscribe:listener=>{listeners.add(listener);return()=>listeners.delete(listener)},setState:patch=>{const previous=state;state={...state,...patch};for(const listener of listeners)listener(state,previous)}}
    return store
  }
  let leaves=0
  const app=observable({servers:[],messages:{},activeServerId:'srv-1'})
  let options={};app.persist={getOptions:()=>options,setOptions:patch=>{options={...options,...patch}}}
  const auth=observable({user:{username:'alice'}}),voice=observable({leaveChannel:async()=>{leaves++}})
  const roles=observable({owner:'alice',configured:false,url:'',connectionVersion:0,snapshot:null,status:'off',activate:async()=>{}})
  const {setupCentralCommunity}=loadTypescript('src/roles/runtime.ts',{
    '../store/useAppStore':{useAppStore:app},'../store/useAuthStore':{useAuthStore:auth},'../store/useVoiceStore':{useVoiceStore:voice},'../store/useRoleStore':{useRoleStore:roles},'../notifications/activity':{withoutActivity:callback=>callback()},'./permissions':{},'./history':{},
  })
  const stop=setupCentralCommunity()
  roles.setState({configured:true,url:'https://community.example.com'})
  assert.equal(leaves,1)
  roles.setState({busy:true});roles.setState({busy:false,status:'connected'})
  assert.equal(leaves,1)
  roles.setState({connectionVersion:1})
  assert.equal(leaves,2)
  roles.setState({url:'https://other.example.com'})
  assert.equal(leaves,3)
  stop()
})

test('a broken event session clears live-only messages so reconnecting cannot offer votes on polls the server no longer authorizes',()=>{
 const observable=initial=>{let state=initial;const listeners=new Set();return {getState:()=>state,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn)},setState:patch=>{const previous=state;state={...state,...patch};for(const fn of listeners)fn(state,previous)}}}
 const app=observable({servers:[{id:'group',name:'Group',channels:[]}],messages:{},activeServerId:'group',activeChannelId:'live'});let options={};app.persist={getOptions:()=>options,setOptions:patch=>{options={...options,...patch}}}
 const auth=observable({user:{username:'alice'}}),voice=observable({activeChannelId:null,leaveChannel:async()=>{}})
 const snapshot={id:'group',name:'Group',actor:'alice',revision:1,channels:[{id:'live',type:'text',serverId:'group'},{id:'history',type:'text',serverId:'group'}],policy:{},messages:{history:[{id:'saved',channelId:'history',content:'Histórico autorizado'}]},channelPermissions:{live:'0',history:'0'},liveMessages:[{id:'poll',channelId:'live',content:'Pergunta recebida ao vivo',poll:{}}]}
 const roles=observable({owner:'alice',serverId:'group',configured:true,status:'connected',snapshot,olderMessages:{},activate:async()=>{}})
 const {setupCentralCommunity}=loadTypescript('src/roles/runtime.ts',{'../store/useAppStore':{useAppStore:app},'../store/useAuthStore':{useAuthStore:auth},'../store/useVoiceStore':{useVoiceStore:voice},'../store/useRoleStore':{useRoleStore:roles},'../notifications/activity':{withoutActivity:fn=>fn()},'./permissions':{can:(_,__,permission,channel)=>permission==='READ_MESSAGE_HISTORY'?channel==='history':true,Permission:{READ_MESSAGE_HISTORY:1n},readMask:()=>0n},'./history':{}},{localStorage:{getItem:()=>null,setItem(){}}})
 const stop=setupCentralCommunity();assert.equal(app.getState().messages.live[0].id,'poll')
 roles.setState({status:'error'});assert.equal(app.getState().messages.live,undefined);assert.equal(app.getState().messages.history[0].id,'saved')
 roles.setState({status:'connected',snapshot:{...snapshot,liveMessages:undefined}});assert.equal(app.getState().messages.live.length,0);assert.equal(app.getState().messages.history[0].id,'saved');stop()
})
