export type ProjectAccess='reader'|'collaborator'|'manager'
export interface AiProject {
  parentId:string
  ownerId:string
  members:Record<string,ProjectAccess>
  model?:string
  createdAt:number
  archived?:boolean
}
export interface AiRunInfo {
  id:string
  promptId?:string
  channelId:string
  actor:string
  model:string
  status:'queued'|'running'|'completed'|'failed'|'cancelled'|'interrupted'
  inputTokens?:number
  outputTokens?:number
  error?:string
  files?:Array<{name:string;size:number;type:string}>
}
export interface AiEvent {serverId:string;channelId:string;type:'ready'|'started'|'current'|'delta'|'done'|'error';runId?:string;actor?:string;model?:string;delta?:string;partial?:string;content?:string;status?:AiRunInfo['status'];error?:string;usage?:AiRunInfo}
export const validAiModel=(value:unknown):value is string=>typeof value==='string'&&/^[\w.:-]{2,100}$/.test(value)
const aiMime:Record<string,string>={
  '.pdf':'application/pdf','.txt':'text/plain','.md':'text/markdown','.json':'application/json','.html':'text/html','.xml':'application/xml','.csv':'text/csv','.tsv':'text/tab-separated-values',
  '.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.odt':'application/vnd.oasis.opendocument.text',
  '.pptx':'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.gif':'image/gif','.webp':'image/webp',
}
const codeExtensions=['js','jsx','ts','tsx','mjs','cjs','css','scss','py','go','rs','java','kt','cs','c','h','cpp','hpp','sh','ps1','sql','yaml','yml','toml','ini','env','vue','svelte','php','rb','swift','dart','gradle','graphql','proto','jsonl','log']
for(const name of codeExtensions)aiMime['.'+name]='text/plain'
export function aiFileMime(name:string):string|null{
  if(typeof name!=='string'||name.length<1||name.length>200||/[\\/\u0000-\u001f]/.test(name))return null
  const extension=/\.[^.]+$/.exec(name)?.[0].toLowerCase()
  return extension?aiMime[extension]||null:null
}
export function activeProject(project:AiProject,members:readonly string[]):boolean{
  return !project.archived&&Object.entries(project.members).some(([member,level])=>level==='manager'&&members.includes(member))
}
