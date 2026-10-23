const title=document.getElementById('title'),detail=document.getElementById('detail'),bar=document.getElementById('bar'),percent=document.getElementById('percent'),close=document.getElementById('close')
close.onclick=()=>window.close()
window.contalkDesktop.onUpdateState(state=>{
  document.body.classList.toggle('installing',state.status==='installing'||state.status==='ready')
  close.hidden=state.status!=='error'
  title.textContent=state.status==='error'?'Não foi possível atualizar':state.status==='installing'||state.status==='ready'?'Instalando atualização...':'Atualizando ConTALK'
  detail.textContent=state.status==='error'?(state.error||'Tente novamente no aplicativo.'):state.status==='installing'||state.status==='ready'?'O ConTALK será reaberto automaticamente.':`Baixando a versão ${state.version}...`
  bar.style.width=`${Math.max(0,Math.min(100,state.progress))}%`
  percent.textContent=state.status==='error'?'':`${Math.max(0,Math.min(100,state.progress))}%`
})
