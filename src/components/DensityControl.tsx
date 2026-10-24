import { useEffect, useRef, useState } from 'react'

export function DensityControl({value,onChange}:{value:number;onChange:(value:number)=>void}) {
  const [draft,setDraft]=useState(String(value))
  const changeRef=useRef(onChange)
  changeRef.current=onChange
  useEffect(()=>setDraft(String(value)),[value])
  const number=Number(draft)
  const valid=draft.trim()!==''&&Number.isInteger(number)&&number>=80&&number<=120
  const step=(amount:number)=>setDraft(current=>{const parsed=Number(current);const base=current.trim()!==''&&Number.isInteger(parsed)&&parsed>=80&&parsed<=120?parsed:value;return String(Math.max(80,Math.min(120,base+amount)))})
  const commit=()=>{if(valid){if(number!==value)onChange(number)}else setDraft(String(value))}
  useEffect(()=>{
    if(!valid||number===value)return
    const timer=setTimeout(()=>changeRef.current(number),400)
    return()=>clearTimeout(timer)
  },[draft,value,valid,number])
  return <div className="ct-density-control"><div className="ct-density-stepper">
    <button type="button" aria-label="Diminuir escala" disabled={valid&&number<=80} onClick={()=>step(-1)}>−</button>
    <label><input id="ct-interface-scale" aria-label="Escala da interface" aria-describedby="ct-density-range" type="number" min="80" max="120" step="1" value={draft} aria-invalid={!valid} onChange={e=>setDraft(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();commit()}}}/><span>%</span></label>
    <button type="button" aria-label="Aumentar escala" disabled={valid&&number>=120} onClick={()=>step(1)}>+</button>
  </div><small id="ct-density-range">De 80% a 120% · padrão 100%</small><button type="button" disabled={value===100&&draft==='100'} onClick={()=>{setDraft('100');if(value!==100)onChange(100)}}>Restaurar 100%</button></div>
}
