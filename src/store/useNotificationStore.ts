import { create } from 'zustand'

export interface ActivityNotice {id:string;kind:'message'|'friendship'|'live'|'voice';title:string;body:string;createdAt:number;read:boolean;channelId?:string;peer?:string;mention?:boolean}
interface ActivityState {owner:string|null;entries:ActivityNotice[];unreadByChannel:Record<string,number>;visibleChannel:string|null;activate:(owner:string|null)=>void;push:(entry:ActivityNotice)=>void;markRead:(id:string)=>void;markChannelRead:(channel:string)=>void;markAllRead:()=>void;setVisibleChannel:(channel:string|null)=>void;clear:()=>void}
const key=(owner:string)=>'contalk-notifications-v1:'+owner
function save(state:Pick<ActivityState,'owner'|'entries'|'unreadByChannel'>){if(state.owner)try{localStorage.setItem(key(state.owner),JSON.stringify({entries:state.entries,unreadByChannel:state.unreadByChannel}))}catch{/* Keep current notifications usable when disk storage is full. */}}
export const useNotificationStore=create<ActivityState>((set,get)=>({
  owner:null,entries:[],unreadByChannel:{},visibleChannel:null,
  activate:owner=>{
    if(owner===get().owner)return
    let entries:ActivityNotice[]=[],unreadByChannel:Record<string,number>={}
    try{const saved=JSON.parse(owner?localStorage.getItem(key(owner))||'{}':'{}');entries=Array.isArray(saved.entries)?saved.entries.filter((e:ActivityNotice)=>e&&typeof e.id==='string'&&typeof e.title==='string'&&typeof e.body==='string'&&Number.isFinite(e.createdAt)).slice(0,200):[];for(const [channel,count]of Object.entries(saved.unreadByChannel||{}))if(typeof count==='number'&&Number.isSafeInteger(count)&&count>0)unreadByChannel[channel]=count}catch{/* No saved state. */}
    set({owner,entries,unreadByChannel,visibleChannel:null})
  },
  push:entry=>{
    const current=get()
    if(!current.owner||current.entries.some(e=>e.id===entry.id))return
    const unreadByChannel={...current.unreadByChannel}
    if(entry.channelId&&!entry.read&&entry.kind==='message')unreadByChannel[entry.channelId]=(unreadByChannel[entry.channelId]||0)+1
    const next={entries:[entry,...current.entries].slice(0,200),unreadByChannel}
    set(next);save({...get(),...next})
  },
  markChannelRead:channel=>{const current=get();const unreadByChannel={...current.unreadByChannel};delete unreadByChannel[channel];const entries=current.entries.map(entry=>entry.channelId===channel?{...entry,read:true}:entry);set({entries,unreadByChannel});save(get())},
  markRead:id=>{const current=get(),entry=current.entries.find(entry=>entry.id===id);if(!entry||entry.read)return;const unreadByChannel={...current.unreadByChannel};if(entry.channelId&&entry.kind==='message'){const count=(unreadByChannel[entry.channelId]||0)-1;if(count>0)unreadByChannel[entry.channelId]=count;else delete unreadByChannel[entry.channelId]}set({entries:current.entries.map(entry=>entry.id===id?{...entry,read:true}:entry),unreadByChannel});save(get())},
  markAllRead:()=>{set({entries:get().entries.map(entry=>({...entry,read:true})),unreadByChannel:{}});save(get())},
  setVisibleChannel:visibleChannel=>{set({visibleChannel});if(visibleChannel&&document.hasFocus()&&!document.hidden)get().markChannelRead(visibleChannel)},
  clear:()=>{set({entries:[],unreadByChannel:{}});save(get())},
}))
