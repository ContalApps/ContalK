import { normalizeReaction } from './chat.ts'

export interface PollDraft{question:string;answers:Array<{text:string;emoji?:string}>;multiple:boolean;durationHours:number}
export interface Poll{question:string;answers:Array<{id:string;text:string;emoji?:string;voters:string[]}>;multiple:boolean;expiresAt:number;closedAt?:number;closedBy?:string}
const text=(value:unknown,limit:number)=>{
  if(typeof value!=='string'||!value.trim()||value.trim().length>limit||/[\p{Cc}\p{Zl}\p{Zp}]/u.test(value.trim()))throw new Error('Use uma pergunta e respostas válidas, sem quebras de linha.')
  return value.trim().normalize('NFC')
}
export function normalizePoll(value:unknown):PollDraft{
  if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Enquete inválida.')
  const draft=value as PollDraft,question=text(draft.question,300)
  if(!Array.isArray(draft.answers)||draft.answers.length<2||draft.answers.length>10||typeof draft.multiple!=='boolean'||!Number.isInteger(draft.durationHours)||draft.durationHours<1||draft.durationHours>768)throw new Error('Use de 2 a 10 respostas e duração entre 1 e 768 horas.')
  const answers=draft.answers.map(answer=>{if(!answer||typeof answer!=='object')throw new Error('Resposta inválida.');return {text:text(answer.text,55),...(answer.emoji!==undefined&&answer.emoji!==''?{emoji:normalizeReaction(answer.emoji)}:{})}})
  if(new Set(answers.map(answer=>answer.text.toLocaleLowerCase('pt-BR'))).size!==answers.length)throw new Error('Use respostas diferentes para a enquete.')
  return {question,answers,multiple:draft.multiple,durationHours:draft.durationHours}
}
export function pollOpen(poll:Poll,now=Date.now()):boolean{return !poll.closedAt&&poll.expiresAt>now}
export function pollVoters(poll:Poll):string[]{return [...new Set(poll.answers.flatMap(answer=>answer.voters))]}
