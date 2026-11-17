import { useEffect, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { can } from '../roles/permissions'
import { ServerIcon } from './ServerIcon'
import { useCommunityStore } from '../store/useCommunityStore'

const ICON_SIZE = 128

// Recorta o centro da imagem em quadrado e reduz para 128x128, dentro do limite aceito pelo serviço.
async function serverIconFromFile(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error('Escolha uma imagem PNG, JPEG ou WebP de até 10 MB.')
  const bitmap = await createImageBitmap(file)
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = ICON_SIZE; canvas.height = ICON_SIZE
    const context = canvas.getContext('2d')!
    context.imageSmoothingQuality = 'high'
    context.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, ICON_SIZE, ICON_SIZE)
    for (const quality of [0.9, 0.8, 0.65]) {
      const data = canvas.toDataURL('image/webp', quality)
      if (data.startsWith('data:image/webp') && data.length <= 70000) return data
    }
    const fallback = canvas.toDataURL('image/jpeg', 0.7)
    if (fallback.length <= 70000) return fallback
    throw new Error('A imagem ficou grande demais. Tente outra.')
  } finally { bitmap.close() }
}

export function ServerOverview(){
  const communityMembers=useCommunityStore(s=>s.members)
  const state=useRoleStore(),snapshot=state.snapshot!
  const current={name:snapshot.name,description:snapshot.description||'',icon:snapshot.icon||null}
  const [draft,setDraft]=useState(current),[base,setBase]=useState(current),[error,setError]=useState(''),[message,setMessage]=useState('')
  const dirty=draft.name!==base.name||draft.description!==base.description||draft.icon!==base.icon,changed=current.name!==base.name||current.description!==base.description||current.icon!==base.icon
  const conflict=dirty&&changed,allowed=can(snapshot.policy,snapshot.actor,'MANAGE_GUILD')
  useEffect(()=>{if(!dirty&&changed){setDraft(current);setBase(current)}},[dirty,changed,current.name,current.description,current.icon])
  const valid=!!draft.name.trim()&&draft.name.trim().length<=100&&draft.description.trim().length<=300

  const save=async()=>{
    setError('');setMessage('')
    try{
      const patch={...(draft.name!==base.name?{name:draft.name}:{}),...(draft.description!==base.description?{description:draft.description}:{}),...(draft.icon!==base.icon?{icon:draft.icon}:{})}
      await state.command({type:'server-edit',patch})
      const saved=useRoleStore.getState().snapshot!;const next={name:saved.name,description:saved.description||'',icon:saved.icon||null}
      setDraft(next);setBase(next);setMessage('Configurações do servidor salvas.')
    }catch(error){setError(error instanceof Error?error.message:'Não foi possível salvar o servidor.')}
  }
  const pickIcon=async(file:File|undefined)=>{
    if(!file)return
    setError('');setMessage('')
    try{const icon=await serverIconFromFile(file);setDraft(value=>({...value,icon}))}catch(error){setError(error instanceof Error?error.message:'Não foi possível ler a imagem.')}
  }
  const members=snapshot.policy.members.length
  const online=communityMembers.filter(member=>member.online&&snapshot.policy.members.includes(member.username)).length
  return <section className="ct-server-overview ct-ss-page" aria-label="Configurações gerais do servidor">
    <div className="ct-ss-columns">
      <form className="ct-ss-form" onSubmit={event=>{event.preventDefault();if(allowed&&valid&&dirty&&!conflict&&!state.busy&&state.status==='connected')void save()}}>
        <p className="ct-ss-intro">Personalize como a comunidade aparece na coluna de servidores, nos convites e para quem entra.</p>
        <fieldset disabled={!allowed||state.busy||state.status!=='connected'}>
          <div className="ct-ss-field">
            <h3>Nome</h3>
            <input aria-label="Nome do servidor" maxLength={100} required value={draft.name} onChange={event=>{setDraft({...draft,name:event.target.value});setMessage('')}}/>
          </div>
          <div className="ct-ss-field">
            <h3>Ícone</h3>
            <p>Use uma imagem quadrada, de preferência com pelo menos 512 × 512. Ela é recortada e reduzida automaticamente.</p>
            <div className="ct-ss-actions">
              <label className="ct-button-primary">Alterar o ícone<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="Escolher foto do servidor" hidden onChange={event=>{const file=event.target.files?.[0];event.target.value='';void pickIcon(file)}}/></label>
              {draft.icon&&<button type="button" className="ct-button-danger-ghost" onClick={()=>setDraft(value=>({...value,icon:null}))}>Remover o ícone</button>}
            </div>
          </div>
          <div className="ct-ss-field">
            <h3>Descrição</h3>
            <p>Conte do que se trata a comunidade e por que vale a pena entrar.</p>
            <textarea aria-label="Descrição do servidor" maxLength={300} rows={4} value={draft.description} onChange={event=>{setDraft({...draft,description:event.target.value});setMessage('')}}/>
            <small className="ct-ss-counter">{draft.description.length}/300</small>
          </div>
        </fieldset>
        {conflict&&<p className="ct-ss-notice" role="alert">As configurações mudaram enquanto você editava. Seu rascunho foi preservado. <button type="button" onClick={()=>{setDraft(current);setBase(current)}}>Carregar configurações atuais</button></p>}
        {!allowed&&<p className="ct-ss-notice">Você precisa da permissão Gerenciar servidor para alterar estas configurações.</p>}
        {error&&<p className="ct-ss-error" role="alert">{error}</p>}
        {message&&<p className="ct-ss-saved" role="status">{message}</p>}
        {allowed&&<footer className="ct-ss-savebar" data-dirty={dirty}>
          <span>{dirty?'Você tem alterações que não foram salvas.':'Tudo salvo.'}</span>
          {dirty&&<button type="button" className="ct-button-ghost" onClick={()=>{setDraft(base);setMessage('')}}>Desfazer</button>}
          <button className="ct-button-primary" disabled={!dirty||!valid||conflict}>Salvar servidor</button>
        </footer>}
      </form>
      <aside className="ct-ss-preview" aria-label="Prévia">
        <div className="ct-ss-preview-banner"/>
        <span className="ct-ss-preview-icon"><ServerIcon name={draft.name||snapshot.name} icon={draft.icon}/></span>
        <div className="ct-ss-preview-body">
          <strong>{draft.name||snapshot.name}</strong>
          <small><i className="ct-online-dot" aria-hidden="true"/>{online} online <i className="ct-offline-dot" aria-hidden="true"/>{members} {members===1?'membro':'membros'}</small>
          {draft.description&&<p>{draft.description}</p>}
        </div>
      </aside>
    </div>
  </section>
}
