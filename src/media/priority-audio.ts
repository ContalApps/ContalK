// Priority changes playback gain, never the listener's saved volume.
export function priorityAudioGain(volume:number,deafened:boolean,microphone:boolean,active:boolean,priority:boolean):number{
  if(deafened)return 0
  const gain=Math.max(0,Math.min(200,Number.isFinite(volume)?volume:100))/100
  return gain*(microphone&&active&&!priority?0.25:1)
}
