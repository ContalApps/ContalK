import { useEffect, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'
import { useAppStore } from '../store/useAppStore'
import { can } from '../roles/permissions'
import { ControlIcon } from './ControlIcon'

export function ServerOverview(){
  const state=useRoleStore(),snapshot=state.snapshot!
  const current={name:snapshot.name,description:snapshot.description||'',icon:snapshot.icon||''}
  const [draft,setDraft]=useState(current),[base,setBase]=useState(current),[error,setError]=useState(''),[message,setMessage]=useState('')
  const dirty=draft.name!==base.name||draft.description!==base.description||draft.icon!==base.icon
  const changed=current.name!==base.name||current.description!==base.description||current.icon!==base.icon
  const conflict=dirty&&changed,allowed=can(snapshot.policy,snapshot.actor,'MANAGE_GUILD')
  useEffect(()=>{if(!dirty&&changed){setDraft(current);setBase(current)}},[dirty,changed,current.name,current.description,current.icon])
  const valid=!!draft.name.trim()&&draft.name.trim().length<=100&&draft.description.trim().length<=300

  const photo=async(file?:File)=>{
    if(!file)return
    setError('')
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){
      setError('Escolha uma foto JPG, PNG ou WebP de até 10 MB.')
      return
    }
    try {
      const bitmap=await createImageBitmap(file)
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160
      const ctx=canvas.getContext('2d')!;const size=Math.min(bitmap.width,bitmap.height)
      ctx.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,160,160);bitmap.close()
      const data=canvas.toDataURL('image/jpeg',.65)
      if(data.length>65000)throw new Error('Escolha uma foto menor.')
      setDraft(d=>({...d,icon:data}))
      setMessage('')
    }catch{
      setError('Não foi possível abrir essa imagem.')
    }
  }

  const save=async()=>{
    setError('');setMessage('')
    try{
      const patch={
        ...(draft.name!==base.name?{name:draft.name}:{}),
        ...(draft.description!==base.description?{description:draft.description}:{}),
        ...(draft.icon!==base.icon?{icon:draft.icon||null}:{})
      }
      await state.command({type:'server-edit',patch})
      const saved=useRoleStore.getState().snapshot!
      const next={name:saved.name,description:saved.description||'',icon:saved.icon||''}
      setDraft(next);setBase(next)
      useAppStore.setState(appState=>({
        servers:appState.servers.map(s=>s.id===saved.id?{...s,name:saved.name,description:saved.description||'',icon:saved.icon}:s)
      }))
      setMessage('Configurações do servidor salvas.')
    }catch(error){
      setError(error instanceof Error?error.message:'Não foi possível salvar o servidor.')
    }
  }

  return (
    <section className="ct-server-overview" aria-label="Configurações gerais do servidor">
      <h3>Visão geral</h3>
      <form onSubmit={event=>{event.preventDefault();if(allowed&&valid&&dirty&&!conflict&&!state.busy&&state.status==='connected')void save()}}>
        <fieldset disabled={!allowed||state.busy||state.status!=='connected'}>
          <div className="ct-server-photo-section">
            <label className="ct-server-photo-label">Foto de perfil da comunidade</label>
            <div className="ct-server-photo-row">
              <label className="ct-server-photo-upload" title="Escolher foto de perfil da comunidade">
                {draft.icon ? (
                  <img src={draft.icon} alt="Foto da comunidade" className="ct-server-photo-img" />
                ) : (
                  <div className="ct-server-photo-placeholder">
                    <span>{draft.name.slice(0, 2).toUpperCase()}</span>
                    <span className="ct-server-photo-hint"><ControlIcon name="camera" size={16} /></span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label="Selecionar foto de perfil da comunidade"
                  disabled={!allowed || state.busy}
                  onChange={e=>void photo(e.target.files?.[0])}
                />
              </label>
              <div className="ct-server-photo-actions">
                <p>Recomendado: imagem quadrada (JPG, PNG ou WebP) de até 10 MB. Ela será exibida na barra lateral e na lista de servidores.</p>
                {draft.icon && (
                  <button
                    type="button"
                    className="ct-server-photo-remove"
                    onClick={()=>{setDraft(d=>({...d,icon:''}));setMessage('')}}
                    disabled={!allowed || state.busy}
                  >
                    Remover foto
                  </button>
                )}
              </div>
            </div>
          </div>
          <label>Nome do servidor<input aria-label="Nome do servidor" maxLength={100} required value={draft.name} onChange={event=>{setDraft({...draft,name:event.target.value});setMessage('')}}/></label>
          <label>Descrição<textarea aria-label="Descrição do servidor" maxLength={300} value={draft.description} onChange={event=>{setDraft({...draft,description:event.target.value});setMessage('')}}/></label>
          <small>{draft.description.length}/300</small>
          <button className="ct-primary" disabled={!dirty||!valid||conflict}>Salvar servidor</button>
        </fieldset>
      </form>
      {conflict&&<p role="alert">As configurações mudaram enquanto você editava. Seu rascunho foi preservado. <button onClick={()=>{setDraft(current);setBase(current)}}>Carregar configurações atuais</button></p>}
      {!allowed&&<p className="ct-muted">Você precisa de Gerenciar servidor para alterar estas configurações.</p>}
      {error&&<p role="alert">{error}</p>}
      {message&&<p role="status">{message}</p>}
    </section>
  )
}
