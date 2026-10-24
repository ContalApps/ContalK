import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import type { Message, MessageOptions, Attachment } from '../store/useAppStore'
import { useRoleStore } from '../store/useRoleStore'
import { canMentionRole } from '../roles/permissions'
import { centralAllows } from '../roles/transport'

function ImagePreview({src,name}:{src:string;name:string}) {
  const [failed,setFailed]=useState(false)
  return failed?<span>Prévia indisponível</span>:<img className="ct-chat-image" src={src} alt={name} loading="lazy" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>
}
export function AttachmentPreview({attachment:a,preview=true}:{attachment:Attachment;preview?:boolean}) {
  const [downloadError,setDownloadError]=useState('')
  if(a.storageId)return <div className="ct-attachment">{preview&&a.thumbnail&&<ImagePreview src={'data:image/jpeg;base64,'+a.thumbnail} name={a.name}/>}<strong>{a.name}</strong><small>{(a.size/1024/1024).toFixed(2)} MB</small><button onClick={()=>{setDownloadError('');void window.contalkDesktop?.openStorageFile(a.storageId!).catch(e=>setDownloadError(e.message))}}>Baixar arquivo</button>{downloadError&&<p role="alert">{downloadError}</p>}</div>
  const image=/^image\/(png|jpeg|gif|webp)$/.test(a.type)
  const src=image?a.data.replace('application/octet-stream',a.type):a.data
  const text=/^(text\/(plain|csv)|application\/json)$/.test(a.type)
  let snippet=''
  if(text)try{snippet=new TextDecoder().decode(Uint8Array.from(atob(a.data.split(',')[1]),c=>c.charCodeAt(0))).slice(0,600)}catch{/* No preview. */}
  return <div className="ct-attachment">{preview&&image&&<ImagePreview src={src} name={a.name}/>}<a href={a.data} download={a.name}><strong>{a.name}</strong><small>{Math.max(1,Math.ceil(a.size/1024))} KB · {a.type||'Arquivo'} · Baixar</small></a>{preview&&snippet&&<pre>{snippet}</pre>}</div>
}
export function MessageContent({content,attachment,preview=true,roleMentions=[],mentionsEveryone}:{content:string;attachment?:Attachment;preview?:boolean;roleMentions?:string[];mentionsEveryone?:'all'|'online'}) {
  const members=useCommunityStore(s=>s.members)
  const snapshot=useRoleStore(s=>s.snapshot)
  const roles=snapshot?.policy.roles||[]
  const renderText=(text:string)=>text.split(/(<@&[\w:-]{1,100}>|@everyone\b|@here\b|@[\w.-]+)/g).map((part,index)=>{
    const match=/^<@&([\w:-]{1,100})>$/.exec(part),role=match?roles.find(role=>role.id===match[1]):undefined
    if(role&&roleMentions.includes(role.id))return <mark className="ct-mention" key={index} aria-label={`Menção ao cargo ${role.name}`}>@{role.name}</mark>
    return part.startsWith('@')&&(members.some(member=>member.username===part.slice(1))||mentionsEveryone&&['@everyone','@here'].includes(part))?<mark className="ct-mention" key={index}>{part}</mark>:part
  })
  const parts=content.split(/(https?:\/\/[^\s<>]+)/g)
  const links=[...new Set(parts.filter(p=>/^https?:\/\//.test(p)))].slice(0,4)
  return <div className="ct-message-content"><p>{parts.map((p,i)=>/^https?:\/\//.test(p)?<a key={i} href={p} target="_blank" rel="noopener noreferrer">{p}</a>:renderText(p))}</p>{preview&&links.map(link=>{try{const url=new URL(link);return <a className="ct-link-preview" key={link} href={url.href} target="_blank" rel="noopener noreferrer">{/\.(png|jpe?g|gif|webp)$/i.test(url.pathname)&&<ImagePreview src={url.href} name="Imagem compartilhada"/>}<strong>{url.hostname}</strong><small>{url.pathname==='/'?'Abrir site':decodeURI(url.pathname)}</small></a>}catch{return null}})}{attachment&&<AttachmentPreview attachment={attachment} preview={preview}/>}</div>
}
export function ChatComposer({onSend,placeholder,disabled=false,channelId}:{onSend:(text:string,attachment?:Attachment,options?:MessageOptions)=>Promise<void>;placeholder:string;disabled?:boolean;channelId?:string}) {
  const [text,setText]=useState(''),[attachment,setAttachment]=useState<Attachment>(),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [localFile,setLocalFile]=useState<{id:string;name:string;size:number;type:string;thumbnail?:string}>()
  const [configure,setConfigure]=useState(false),[serviceUrl,setServiceUrl]=useState(''),[serviceToken,setServiceToken]=useState('')
  const [preview,setPreview]=useState(true),[once,setOnce]=useState(false)
  const members=useCommunityStore(s=>s.members)
  const snapshot=useRoleStore(s=>s.snapshot),self=useAuthStore(s=>s.user?.username)
  const mentionRoles=snapshot&&self&&channelId?snapshot.policy.roles.filter(role=>role.id!==snapshot.policy.serverId&&canMentionRole(snapshot.policy,self,role,channelId)):[]
  const canAttach=!channelId||centralAllows('ATTACH_FILES',channelId)
  const canPreview=!channelId||centralAllows('EMBED_LINKS',channelId)
  const choose=async(file?:File)=>{
    if(disabled||!canAttach){setError('Seu cargo não permite anexar arquivos neste canal.');return}
    if(!file)return
    if(file.size>1048576){setError('Escolha um arquivo de até 1 MB.');return}
    setBusy(true);setError('')
    try{const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onerror=reject;reader.onload=()=>resolve(String(reader.result).replace(/^data:[^,]*,/, 'data:application/octet-stream;base64,'));reader.readAsDataURL(file)})
      setAttachment({name:file.name.slice(0,200),type:file.type.slice(0,100),size:file.size,data})
    }catch{setError('Não foi possível ler o arquivo.')}finally{setBusy(false)}
  }
  const pick=async()=>{setError('');try{const desktop=window.contalkDesktop;if(!desktop)throw new Error('Use o aplicativo desktop para anexar arquivos.');if(!await desktop.storageStatus()){setConfigure(true);return}const file=await desktop.selectStorageFile();if(file){setLocalFile(file);setAttachment(undefined)}}catch(e){setError(e instanceof Error?e.message:'Falha ao selecionar.')}}
  return <div className="ct-chat-compose">{configure&&<form className="ct-storage-setup" onSubmit={async e=>{e.preventDefault();try{await window.contalkDesktop!.configureStorage({url:serviceUrl,token:serviceToken});setServiceToken('');setConfigure(false);await pick()}catch(e){setError(e instanceof Error?e.message:'Falha na configuração.')}}}><p>Conectar ao armazenamento central do ConTALK. Peça o endereço e sua chave ao administrador.</p><input aria-label="Endereço do armazenamento" placeholder="https://arquivos.exemplo.com" value={serviceUrl} onChange={e=>setServiceUrl(e.target.value)} required/><input type="password" aria-label="Chave de acesso ao armazenamento" value={serviceToken} onChange={e=>setServiceToken(e.target.value)} required/><button>Conectar</button><button type="button" onClick={()=>setConfigure(false)}>Cancelar</button></form>}{localFile&&<div className="ct-pending-attachment">{preview&&localFile.thumbnail&&<ImagePreview src={'data:image/jpeg;base64,'+localFile.thumbnail} name={localFile.name}/>}<strong>{localFile.name}</strong><small>{(localFile.size/1024/1024).toFixed(2)} MB</small><button onClick={()=>setLocalFile(undefined)}>Remover anexo</button></div>}<div className="ct-send-options"><label><input type="checkbox" checked={preview&&canPreview} disabled={!canPreview} onChange={e=>setPreview(e.target.checked)}/> Gerar prévia</label><label><input type="checkbox" checked={once} onChange={e=>setOnce(e.target.checked)}/> Visualização única por pessoa</label><select aria-label="Mencionar pessoa" value="" onChange={e=>{const value=e.target.value;setText(text+(value.startsWith('role:')?' <@&'+value.slice(5)+'> ':value.startsWith('all:')?' @'+value.slice(4)+' ':' @'+value+' '))}}><option value="">@ Mencionar</option>{members.map(m=><option key={m.username} value={m.username}>{m.display_name}</option>)}{mentionRoles.length>0&&<optgroup label="Cargos">{mentionRoles.map(role=><option key={role.id} value={'role:'+role.id}>{role.name}</option>)}</optgroup>}{channelId&&snapshot&&centralAllows('MENTION_EVERYONE',channelId)&&<optgroup label="Todos"><option value="all:everyone">@everyone</option><option value="all:here">@here</option></optgroup>}</select></div>{attachment&&<div className="ct-pending-attachment"><AttachmentPreview attachment={attachment}/><button type="button" disabled={busy} onClick={()=>setAttachment(undefined)}>Remover anexo</button></div>}<form className="ct-composer" onSubmit={async e=>{e.preventDefault();if(busy||disabled||(!text.trim()&&!attachment&&!localFile))return;setBusy(true);setError('');try{let uploaded=attachment
      if(localFile)uploaded=await window.contalkDesktop!.uploadStorageFile(localFile.id)
      else if(attachment&&!attachment.storageId){if(!window.contalkDesktop)throw new Error('Use o aplicativo desktop para enviar anexos.');if(!await window.contalkDesktop.storageStatus()){setConfigure(true);throw new Error('Configure o armazenamento central.')}uploaded=await window.contalkDesktop.uploadInlineAttachment(attachment)}
      if(uploaded){setAttachment(uploaded);setLocalFile(undefined)}
      await onSend(text,uploaded,{preview,once});setText('');setAttachment(undefined)}catch(e){setError(e instanceof Error?e.message:'Falha ao enviar.')}finally{setBusy(false)}}}>
    <button type="button" className="ct-attach-button" aria-label="Anexar imagem ou arquivo (até 2 GB)" disabled={busy||disabled||!canAttach} onClick={()=>void pick()}>＋</button>
    <input list="ct-mention-users" aria-label="Mensagem" maxLength={2000} placeholder={placeholder} value={text} disabled={busy||disabled} onChange={e=>setText(e.target.value)} onPaste={e=>{const file=e.clipboardData.files[0];if(file){e.preventDefault();void choose(file)}}}/><button className="ct-primary" disabled={busy||disabled||(!text.trim()&&!attachment)}>{busy?'Enviando…':'Enviar'}</button></form><div className="ct-composer-hint" role={error?'alert':undefined}>{error||'Anexe arquivos de até 2 GB. Imagens coladas: até 1 MB.'}</div></div>
}


export function ChatMessage({message:m}:{message:Message}) {
  const username=useAuthStore(s=>s.user?.username)||''
  const own=m.userId===username
  const storageKey='contalk-viewed:'+username+':'+m.id
  const [viewed,setViewed]=useState(()=>localStorage.getItem(storageKey)==='true')
  const [opened,setOpened]=useState(false),[editing,setEditing]=useState(false),[draft,setDraft]=useState(m.content),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const change=async(content?:string)=>{setBusy(true);setError('');try{await useCommunityStore.getState().changeMessage(m.channelId,m.id,content);setEditing(false)}catch(e){setError(e instanceof Error?e.message:'Falha ao alterar.')}finally{setBusy(false)}}
  const body=<MessageContent content={m.content} attachment={m.attachment} preview={m.preview!==false} roleMentions={m.roleMentions} mentionsEveryone={m.mentionsEveryone}/>
  return <div>{m.once&&!own?<>{viewed&&!opened?<p>Mensagem já visualizada</p>:<button disabled={busy} onClick={async()=>{setBusy(true);try{if(!window.contalkDesktop)throw new Error('Abra no ConTALK desktop.');const allowed=await window.contalkDesktop.claimMessageView(m.id);localStorage.setItem(storageKey,'true');setViewed(true);if(allowed)setOpened(true)}catch(e){setError(e instanceof Error?e.message:'Não foi possível registrar a visualização.')}finally{setBusy(false)}}}>Abrir uma vez</button>}{opened&&<div role="dialog" aria-modal="true" className="ct-modal-backdrop"><section className="ct-edit-dialog">{body}<button onClick={()=>setOpened(false)}>Fechar visualização</button></section></div>}</>:editing?<form onSubmit={e=>{e.preventDefault();void change(draft)}}><textarea maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)}/><button disabled={busy}>Salvar</button><button type="button" onClick={()=>setEditing(false)}>Cancelar</button></form>:body}{m.editedAt&&<small>Editada</small>}{own&&<div className="ct-message-actions"><button disabled={busy} onClick={()=>{setDraft(m.content);setEditing(true)}}>Editar</button><button disabled={busy} onClick={()=>void change()}>Apagar</button></div>}{error&&<p role="alert">{error}</p>}</div>
}
