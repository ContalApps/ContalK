import {test} from 'node:test'
import assert from 'node:assert/strict'
import {priorityAudioGain} from '../src/media/priority-audio.ts'
import {voicePermissions} from '../scripts/community/realtime.mjs'
import {initialPolicy,mask} from '../src/roles/permissions.ts'

test('priority ducks only nonpriority microphones and preserves exact personal volume and stream audio',()=>{
 assert.equal(priorityAudioGain(80,false,true,true,false),0.2)
 assert.equal(priorityAudioGain(160,false,true,true,false),0.4)
 assert.equal(priorityAudioGain(120,false,true,true,true),1.2)
 assert.equal(priorityAudioGain(140,false,false,true,false),1.4)
 assert.equal(priorityAudioGain(160,false,true,false,false),1.6)
 assert.equal(priorityAudioGain(0,false,true,true,false),0)
 assert.equal(priorityAudioGain(999,false,true,true,false),0.5)
})

test('personal and server deafen override priority for both voice and screen audio',()=>{
 for(const microphone of [true,false])for(const active of [true,false])for(const priority of [true,false])assert.equal(priorityAudioGain(180,true,microphone,active,priority),0)
})

test('priority is granted by channel/category permissions and removed by timeout or voice restrictions',()=>{
 const policy=initialPolicy('group',['alice','bob']);policy.ownerIds=['alice'];policy.categories=[{id:'cat',name:'Voz'}];policy.channelCategories.voice={categoryId:'cat',synced:true};policy.overwrites.cat=[{id:'bob',type:'member',allow:mask(['PRIORITY_SPEAKER']).toString(),deny:'0'}]
 assert.equal(voicePermissions(policy,'bob','voice').canPrioritySpeaker,true);assert.equal(voicePermissions(policy,'bob','other').canPrioritySpeaker,false)
 policy.timeouts.bob=Date.now()+60000;assert.equal(voicePermissions(policy,'bob','voice').canPrioritySpeaker,false);policy.timeouts={}
 policy.voiceRestrictions={bob:{muted:true,deafened:false}};assert.equal(voicePermissions(policy,'bob','voice').canPrioritySpeaker,false)
 const hq=initialPolicy('srv-1',['alice','bob']);assert.equal(voicePermissions(hq,'bob','voice').canPrioritySpeaker,true);assert.equal(hq.ownership,'all-members')
})
