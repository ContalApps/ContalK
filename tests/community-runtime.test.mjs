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
    '../store/useAppStore':{useAppStore:app},'../store/useAuthStore':{useAuthStore:auth},'../store/useVoiceStore':{useVoiceStore:voice},'../store/useRoleStore':{useRoleStore:roles},'../notifications/activity':{withoutActivity:callback=>callback()},'./permissions':{},
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
