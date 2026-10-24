import { createCipheriv, createDecipheriv, randomBytes, createHmac, timingSafeEqual } from 'node:crypto'
export const MAX_UPLOAD_SIZE=2*1024**3
export function sealSession(value,key){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,cipher.update(value),cipher.final(),cipher.getAuthTag()])}
export function openSession(data,key){const cipher=createDecipheriv('aes-256-gcm',key,data.subarray(0,12));cipher.setAuthTag(data.subarray(-16));return Buffer.concat([cipher.update(data.subarray(12,-16)),cipher.final()]).toString()}
export const signDownload=(key,id,expires)=>createHmac('sha256',key).update(id+':'+expires).digest('hex')
export function validDownload(key,id,expires,provided,now=Date.now()){
 const expected=signDownload(key,id,expires)
 return Number.isSafeInteger(expires)&&expires>=now&&typeof provided==='string'&&provided.length===expected.length&&timingSafeEqual(Buffer.from(provided),Buffer.from(expected))
}
export function storageOwner(tokens,token){return typeof token==='string'&&Object.hasOwn(tokens,token)&&typeof tokens[token]==='string'?tokens[token]:null}
export const signScopedDownload=(key,id,expires,viewer)=>createHmac('sha256',key).update(JSON.stringify([id,expires,viewer])).digest('hex')
export function validScopedDownload(key,id,expires,viewer,provided,now=Date.now()){
 const expected=signScopedDownload(key,id,expires,viewer)
 return Number.isSafeInteger(expires)&&expires>=now&&typeof viewer==='string'&&typeof provided==='string'&&provided.length===expected.length&&timingSafeEqual(Buffer.from(provided),Buffer.from(expected))
}
