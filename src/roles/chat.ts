export const MAX_PINS=250
export const MAX_REACTIONS=20
export const reactionChoices=['👍','❤️','😂','🎉','👀','✅','🤔','🔥']
export function normalizeReaction(value:unknown):string{
  if(typeof value!=='string'||value.length>40)throw new Error('Escolha um único emoji Unicode.')
  const emoji=value.normalize('NFC').replace(/\uFE0F/g,'')
  if(!/^(?:\u{1F3F4}[\u{E0061}-\u{E007A}]{2,8}\u{E007F}|\p{Regional_Indicator}{2}|[0-9#*]\u20E3|\p{Extended_Pictographic}(?:\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\p{Emoji_Modifier})?)*)$/u.test(emoji))throw new Error('Escolha um único emoji Unicode.')
  return emoji
}
export function slowmodeDeadline(seconds:number|undefined,lastSent:number|undefined):number{
  return seconds&&lastSent?lastSent+seconds*1000:0
}
