const title=document.getElementById('title'),detail=document.getElementById('detail'),bar=document.getElementById('bar'),percent=document.getElementById('percent'),close=document.getElementById('close'),version=document.getElementById('version')
close.onclick=()=>window.close()
window.contalkDesktop.onUpdateState(state=>{
  const installing=state.status==='installing'||state.status==='ready',failed=state.status==='error',progress=Math.max(0,Math.min(100,Math.round(state.progress||0)))
  document.body.classList.toggle('installing',installing)
  document.body.classList.toggle('failed',failed)
  close.hidden=!failed
  version.textContent=state.version?`Versão ${state.version}`:''
  title.textContent=failed?'Não foi possível atualizar':installing?'Instalando a atualização':'Atualizando o ConTalk'
  detail.textContent=failed?(state.error||'Tente de novo pelo botão Atualizar no app.'):installing?'O ConTalk fecha e abre de novo sozinho.':'Baixando a versão nova. Pode levar alguns segundos.'
  bar.style.width=`${progress}%`
  bar.parentElement.setAttribute('aria-valuenow',String(progress))
  percent.textContent=failed?'':`${progress}%`
})
