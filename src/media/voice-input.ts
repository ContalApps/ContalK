export type VoiceInputMode='voice-activity'|'push-to-talk'
// Only the selected key is sampled. Ordinary typing is never observed or stored.
export const pushToTalkKeys:Record<string,{label:string;virtualKey:number}>={
  ...Object.fromEntries(Array.from({length:19},(_,index)=>['F'+(index+6),{label:'F'+(index+6),virtualKey:0x75+index}])),
  ControlRight:{label:'Ctrl direito',virtualKey:0xa3},
  Numpad0:{label:'0 do teclado numérico',virtualKey:0x60},
}
export function validInputMode(value:unknown):value is VoiceInputMode{return value==='voice-activity'||value==='push-to-talk'}
export function validPushToTalkKey(value:unknown):value is string{return typeof value==='string'&&Object.prototype.hasOwnProperty.call(pushToTalkKeys,value)}
