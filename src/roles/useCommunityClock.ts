import { useEffect, useState } from 'react'
import { useRoleStore } from '../store/useRoleStore'

export function useCommunityClock(deadline:number,ticking=false){
  const serverNow=useRoleStore(state=>state.snapshot?.serverNow)
  const [now,setNow]=useState(serverNow??Date.now())
  useEffect(()=>{
    const base=serverNow??Date.now(),started=performance.now()
    let timer:ReturnType<typeof setTimeout>|undefined
    const update=()=>{const value=base+performance.now()-started;setNow(value);const remaining=deadline-value;if(remaining>0)timer=setTimeout(update,Math.min(2147483647,ticking?Math.min(1000,remaining):remaining))}
    update();return()=>clearTimeout(timer)
  },[serverNow,deadline,ticking])
  return now
}
