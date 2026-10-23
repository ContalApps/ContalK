import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'
function fixture(label='Microphone (USB Headset)') {
 let stopped=false;let muted=false;let published=0;let removed=0;let options
 const track={mediaStreamTrack:{label,readyState:'live'},stop(){stopped=true},async mute(){muted=true},async unmute(){muted=false}}
 const old={mediaStreamTrack:{label:'Old USB Microphone',readyState:'live'},async mute(){},async unmute(){}}
 let publication={track:old}
 const room={localParticipant:{getTrackPublication:()=>publication,async unpublishTrack(){removed++;publication=undefined},async publishTrack(t){published++;publication={track:t}}}}
 const api=loadTypescript('src/media/microphone.ts',{'livekit-client':{Track:{Source:{Microphone:'microphone'}},AudioPresets:{speech:{}},createLocalAudioTrack:async constraints=>{options=constraints;return track}}})
 return {api,room,track,setLabel:value=>track.mediaStreamTrack.label=value,get stopped(){return stopped},get muted(){return muted},get published(){return published},get removed(){return removed},get options(){return options}}
}
test('recognizes known loopback inputs without rejecting physical microphones',()=>{
 const f=fixture()
 for(const label of ['Stereo Mix (Realtek)','Mixagem estéreo','CABLE Output','Voicemeeter Output','Monitor of Speakers','What U Hear'])assert.equal(f.api.isLoopbackInput(label),true,label)
 for(const label of ['Microphone (USB Headset)','Microfone (Realtek Audio)','SteelSeries Sonar - Microphone'])assert.equal(f.api.isLoopbackInput(label),false,label)
})
test('microphone capture uses exact input, mono, echo/noise processing, and no auto gain',()=>{
 const options=fixture().api.microphoneOptions('physical-device')
 assert.equal(options.deviceId.exact,'physical-device');assert.equal(options.channelCount,1);assert.equal(options.echoCancellation,true);assert.equal(options.noiseSuppression,true);assert.equal(options.autoGainControl,false)
})
test('rejects system mix before publishing and preserves the previous input',async()=>{
 const f=fixture('Stereo Mix (Realtek)')
 await assert.rejects(f.api.publishSafeMicrophone(f.room,''),/mistura/)
 assert.equal(f.published,0);assert.equal(f.removed,0);assert.equal(f.stopped,true)
})
test('device replacement preserves mute and deafen',async()=>{
 const f=fixture();await f.api.publishSafeMicrophone(f.room,'physical-device',true)
 assert.equal(f.muted,true);assert.equal(f.published,1);assert.equal(f.removed,1)
})
test('an existing mixer track is removed instead of being unmuted',async()=>{
 const f=fixture();await f.api.publishSafeMicrophone(f.room,'physical-device')
 f.setLabel('Stereo Mix')
 await assert.rejects(f.api.setSafeMicrophoneEnabled(f.room,true,''),/loopback/)
 assert.equal(f.removed,2)
})
