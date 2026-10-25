import { create } from 'zustand'
import type { CommunityAction, CommunitySnapshot } from '../roles/types'
import type { Message } from './useAppStore'
import { mergeHistory } from '../roles/history'

interface RoleState {
  owner:string|null
  serverId:string|null
  configured:boolean
  url:string
  connectionVersion:number
  status:'off'|'loading'|'connected'|'error'|'revoked'
  snapshot:CommunitySnapshot|null
  error:string
  busy:boolean
  olderMessages:Record<string,Message[]>
  historyMore:Record<string,boolean>
  historyBusy:boolean
  activate:(owner:string|null,serverId?:string)=>Promise<void>
  configure:(value:{url:string;token:string})=>Promise<void>
  command:(action:CommunityAction)=>Promise<void>
  refresh:()=>Promise<void>
  loadHistory:(channelId:string)=>Promise<void>
  previewInvite:(code:string)=>Promise<import('../roles/invites').InvitePreview>
  acceptInvite:(code:string)=>Promise<CommunitySnapshot>
}
let generation=0
let unsubscribe:(()=>void)|undefined
export const useRoleStore=create<RoleState>((set,get)=>({
  owner:null,serverId:null,configured:false,url:'',connectionVersion:0,status:'off',snapshot:null,error:'',busy:false,olderMessages:{},historyMore:{},historyBusy:false,
  activate:async(owner,serverId='srv-1')=>{
    const current=get()
    if(owner===current.owner&&serverId===current.serverId&&current.status!=='revoked')return
    const version=++generation
    unsubscribe?.();unsubscribe=undefined
    const bridge=window.contalkDesktop
    void bridge?.unsubscribeCommunity?.().catch(()=>{})
    const retainConfiguration=!!owner&&owner===current.owner&&current.configured
    set({owner,serverId:owner?serverId:null,configured:retainConfiguration,url:retainConfiguration?current.url:'',status:owner&&bridge?.communityStatus?'loading':'off',snapshot:null,error:'',busy:false,olderMessages:{},historyMore:{},historyBusy:false})
    if(!owner||!bridge?.communityStatus)return
    try{
      const configuration=await bridge.communityStatus()
      if(version!==generation)return
      set({configured:configuration.configured,url:configuration.url||'',status:configuration.configured?'loading':'off'})
      if(!configuration.configured)return
      unsubscribe=bridge.onCommunityState(event=>{
        if(version!==generation||event.serverId!==serverId)return
        if(event.accessRevoked){generation++;unsubscribe?.();unsubscribe=undefined;set({status:'revoked',snapshot:null,olderMessages:{},historyMore:{},historyBusy:false,busy:false,error:'Seu acesso a este servidor foi removido.'});return}
        if(event.error){set({status:'error',error:event.error,olderMessages:{},historyMore:{}});return}
        const snapshot=event.snapshot
        if(!snapshot||snapshot.actor!==owner||snapshot.id!==serverId)return
        if(get().snapshot&&snapshot.revision<get().snapshot!.revision)return
        acceptSnapshot(snapshot)
      })
      await bridge.subscribeCommunity(serverId)
    }catch(error){if(version===generation)set({status:'error',error:error instanceof Error?error.message:'Não foi possível acessar a comunidade.'})}
  },
  configure:async value=>{
    const bridge=window.contalkDesktop
    if(!bridge?.configureCommunity)throw new Error('Use o aplicativo desktop para conectar a comunidade.')
    const {owner,serverId}=get(),version=generation
    if(!owner)throw new Error('Entre no ConTALK.')
    await bridge.configureCommunity(value)
    if(version!==generation)return
    set({owner:null,serverId:null,connectionVersion:get().connectionVersion+1})
    await get().activate(owner,serverId||'srv-1')
  },
  previewInvite:async code=>{
    const {owner,configured}=get(),bridge=window.contalkDesktop,version=generation
    if(!owner||!configured||!bridge?.communityInvitePreview)throw new Error('Conecte a comunidade para usar um convite.')
    const preview=await bridge.communityInvitePreview(code)
    if(version!==generation||get().owner!==owner)throw new Error('A conta ou a comunidade foi alterada. Confira o convite novamente.')
    return preview
  },
  acceptInvite:async code=>{
    const {owner,configured,busy}=get(),bridge=window.contalkDesktop,version=generation
    if(!owner||!configured||!bridge?.communityInviteAccept)throw new Error('Conecte a comunidade para usar um convite.')
    if(busy)throw new Error('Aguarde a alteração atual.')
    set({busy:true})
    try{
      const next=await bridge.communityInviteAccept(code)
      if(version!==generation||get().owner!==owner||next.actor!==owner)throw new Error('A conta ou a comunidade foi alterada. Confira o acesso antes de continuar.')
      return next
    }finally{if(version===generation)set({busy:false})}
  },
  command:async action=>{
    const {snapshot,owner,serverId}=get(),bridge=window.contalkDesktop,version=generation
    if(!snapshot||!bridge?.communityCommand||get().status!=='connected')throw new Error('Reconecte a comunidade antes de fazer alterações.')
    if(get().busy)throw new Error('Aguarde a alteração atual.')
    set({busy:true,error:''})
    try{
      const next=await bridge.communityCommand(snapshot.id,snapshot.revision,action)
      if(version!==generation||next.actor!==owner||next.id!==serverId)return
      if(next.revision>=(get().snapshot?.revision||0))acceptSnapshot(next)
    }catch(error){if(version===generation){set({error:error instanceof Error?error.message:'Não foi possível salvar.'});await get().refresh().catch(()=>{})}throw error}
    finally{if(version===generation)set({busy:false})}
  },
  refresh:async()=>{
    const {owner,serverId}=get(),version=generation,bridge=window.contalkDesktop
    if(!owner||!serverId||!bridge?.communitySnapshot)return
    const snapshot=await bridge.communitySnapshot(serverId)
    if(version!==generation||snapshot.actor!==owner||snapshot.id!==serverId)return
    if(snapshot.revision>=(get().snapshot?.revision||0))acceptSnapshot(snapshot)
  },
  loadHistory:async channelId=>{
    const current=get(),bridge=window.contalkDesktop,version=generation
    if(!current.snapshot||!bridge?.communityHistory||current.historyBusy||current.status!=='connected'||!(current.historyMore[channelId]??current.snapshot.hasOlder?.[channelId]))return
    const before=current.olderMessages[channelId]?.[0]?.id||current.snapshot.messages[channelId]?.[0]?.id
    set({historyBusy:true,error:''})
    try{
      const page=await bridge.communityHistory(current.snapshot.id,channelId,before)
      const latest=get()
      if(version!==generation||page.serverId!==latest.serverId||page.channelId!==channelId||!latest.snapshot?.messages[channelId])return
      if(page.revision<latest.snapshot.revision)throw new Error('O histórico mudou durante a leitura. Tente carregar novamente.')
      const windowIds=new Set(latest.snapshot.messages[channelId].map(message=>message.id))
      const rows=new Map([...page.messages,...(latest.olderMessages[channelId]||[])].filter(message=>!windowIds.has(message.id)).map(message=>[message.id,message]))
      set({olderMessages:{...latest.olderMessages,[channelId]:[...rows.values()]},historyMore:{...latest.historyMore,[channelId]:page.hasMore}})
    }catch(error){if(version===generation)set({error:error instanceof Error?error.message:'Não foi possível carregar o histórico.'});throw error}
    finally{if(version===generation)set({historyBusy:false})}
  },
}))

function acceptSnapshot(snapshot:CommunitySnapshot){
  const current=useRoleStore.getState()
  const previous=current.status==='error'?null:current.snapshot
  const olderMessages=mergeHistory(previous,snapshot,previous?current.olderMessages:{})
  const historyMore:Record<string,boolean>={}
  for(const channel of Object.keys(snapshot.messages))historyMore[channel]=previous?(current.historyMore[channel]??previous.hasOlder?.[channel]??snapshot.hasOlder?.[channel]??false):(snapshot.hasOlder?.[channel]??false)
  useRoleStore.setState({snapshot,olderMessages,historyMore,status:'connected',error:''})
}
