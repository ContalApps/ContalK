import { useState } from 'react'
import { useAuthStore } from '../store/useAuthStore'
import { useCommunityStore } from '../store/useCommunityStore'
import { useVoiceStore } from '../store/useVoiceStore'

export function EditProfile({onClose}:{onClose:()=>void}) {
  const user=useAuthStore(s=>s.user)!
  const [name,setName]=useState(user.display_name)
  const [bio,setBio]=useState(user.bio || '')
  const [avatar,setAvatar]=useState(user.avatar || '')
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const photo=async(file?:File)=>{
    if(!file)return
    setError('')
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){setError('Escolha uma foto JPG, PNG ou WebP de até 10 MB.');return}
    try {
      const bitmap=await createImageBitmap(file)
      const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160
      const ctx=canvas.getContext('2d')!;const size=Math.min(bitmap.width,bitmap.height)
      ctx.drawImage(bitmap,(bitmap.width-size)/2,(bitmap.height-size)/2,size,size,0,0,160,160);bitmap.close()
      const data=canvas.toDataURL('image/jpeg',.65)
      if(data.length>48000)throw new Error('Escolha uma foto menor.')
      setAvatar(data)
    } catch {setError('Não foi possível abrir essa imagem.')}
  }
  const save=async(e:React.FormEvent)=>{e.preventDefault();setBusy(true);setError('');try{
    await useAuthStore.getState().updateProfile({display_name:name,bio,avatar})
    const updated=useAuthStore.getState().user!
    await useCommunityStore.getState().updateProfile(updated)
    const room=useVoiceStore.getState().currentRoom
    if(room){await room.localParticipant.setName(updated.display_name);await room.localParticipant.setMetadata(JSON.stringify({avatar}));useVoiceStore.getState().refreshParticipants()}
    onClose()
  }catch{setError('Não foi possível sincronizar o perfil. Tente novamente.')}finally{setBusy(false)}}
  return <div className="ct-modal-backdrop"><form className="ct-edit-dialog" onSubmit={save}><h2>Editar perfil</h2><label className="ct-photo-upload">{avatar?<img src={avatar} alt="Prévia do avatar"/>:<span>Escolher foto</span>}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={e=>void photo(e.target.files?.[0])}/></label>{avatar&&<button type="button" onClick={()=>setAvatar('')}>Remover foto</button>}<label>Nome de exibição<input autoFocus value={name} maxLength={40} required onChange={e=>setName(e.target.value)}/></label><label>Sobre mim<textarea value={bio} maxLength={240} onChange={e=>setBio(e.target.value)}/></label>{error&&<p role="alert">{error}</p>}<footer><button type="button" disabled={busy} onClick={onClose}>Cancelar</button><button className="ct-primary" disabled={busy||!name.trim()}>Salvar perfil</button></footer></form></div>
}
