import { createHash, timingSafeEqual } from 'node:crypto'

export const validFileId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function validInternalToken(provided,expected){
  if(typeof provided!=='string'||typeof expected!=='string'||provided.length<32||provided.length>512||expected.length<32||expected.length>512)return false
  const digest=value=>createHash('sha256').update(value).digest()
  return timingSafeEqual(digest(provided),digest(expected))
}
export function internalClient(url,token){
  if(typeof token!=='string'||token.length<32||token.length>512||/[\r\n]/.test(token))throw new Error('Configure uma chave interna de pelo menos 32 caracteres.')
  const target=new URL(url)
  if(!['http:','https:'].includes(target.protocol)||target.username||target.password||(target.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(target.hostname)))throw new Error('Use HTTPS ou um endereço local para a comunicação interna.')
  return async(route,body)=>{
    const response=await fetch(new URL(route,target.origin),{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)})
    if(!response.ok)throw new Error('O serviço interno de autorização está indisponível.')
    const result=await response.json()
    if(typeof result.allowed!=='boolean')throw new Error('Resposta inválida do serviço de autorização.')
    return result.allowed
  }
}
export function createFileReferenceClient({url,token}){
  const request=internalClient(url,token)
  return {canReference:(username,storageId)=>request('/internal/files/'+storageId+'/reference',{username})}
}
export function createStorageAuthorizer({url,token}){
  const request=internalClient(url,token)
  return (username,storageId)=>request('/internal/files/authorize',{username,storageId})
}
