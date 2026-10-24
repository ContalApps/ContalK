// Central Telegram storage. Run login once in the administrator's terminal.
import { createStorageServer } from './storage-server.mjs'
import { createStorageAuthorizer } from './community/files.mjs'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createInterface } from 'node:readline/promises'
import path from 'node:path'
import { TelegramClient, Api, utils } from 'telegram'
import { StringSession } from 'telegram/sessions/index.js'
import { CustomFile } from 'telegram/client/uploads.js'

import { sealSession, openSession } from './storage-policy.mjs'
const directory=path.resolve(process.env.CONTALK_STORAGE_DATA||'.storage-data')
mkdirSync(directory,{recursive:true,mode:0o700})
const key=Buffer.from(process.env.TELEGRAM_VAULT_KEY||'','hex')
if(key.length!==32)throw new Error('Configure TELEGRAM_VAULT_KEY com 32 bytes em hexadecimal.')
const vault=path.join(directory,'telegram.enc')
const encrypt=value=>sealSession(value,key)
const decrypt=data=>openSession(data,key)
const client=new TelegramClient(new StringSession(existsSync(vault)?decrypt(readFileSync(vault)):''),Number(process.env.TELEGRAM_API_ID),process.env.TELEGRAM_API_HASH,{connectionRetries:5,deviceModel:'ConTALK Storage'})
client.setLogLevel('error')
if(process.argv[2]==='login'){
 const terminal=createInterface({input:process.stdin,output:process.stdout})
 try{await client.start({phoneNumber:()=>terminal.question('Telefone com DDI: '),phoneCode:()=>terminal.question('Código recebido no Telegram: '),password:()=>terminal.question('Senha de duas etapas (entrada visível neste terminal privado): '),onError:error=>{throw error}});writeFileSync(vault,encrypt(client.session.save()),{mode:0o600});console.log('Sessão central salva com criptografia.')}finally{terminal.close();await client.disconnect()}
 process.exit(0)
}
const tokens=JSON.parse(process.env.CONTALK_STORAGE_TOKENS||'{}')
if(!Object.keys(tokens).length)throw new Error('Configure CONTALK_STORAGE_TOKENS: JSON de token para username.')
const publicUrl=new URL(process.env.CONTALK_STORAGE_PUBLIC_URL||'http://127.0.0.1:8788')
await client.connect()
if(!await client.checkAuthorization())throw new Error('Execute primeiro: node scripts/telegram-storage-server.mjs login')
let channel
const channelFile=path.join(directory,'channel.json')
if(existsSync(channelFile)){const saved=JSON.parse(readFileSync(channelFile,'utf8'));channel=await client.getEntity(new Api.InputPeerChannel({channelId:utils.parseID(saved.id),accessHash:utils.parseID(saved.accessHash)}))}
else{
 const existing=(await client.getDialogs({limit:200})).find(d=>d.title==='ConTALK Storage'&&d.isChannel&&!d.entity?.username)
 channel=existing?.entity
 if(!channel){const result=await client.invoke(new Api.channels.CreateChannel({title:'ConTALK Storage',about:'Arquivos compartilhados no ConTALK',broadcast:true}));channel=result.chats[0]}
 writeFileSync(channelFile,JSON.stringify({id:String(channel.id),accessHash:String(channel.accessHash)}),{mode:0o600})
}
if(channel.username)throw new Error('O canal central deve ser privado.')
const internalToken=process.env.CONTALK_COMMUNITY_INTERNAL_TOKEN
const communityUrl=process.env.CONTALK_COMMUNITY_URL
if(Boolean(internalToken)!==Boolean(communityUrl))throw new Error('Configure CONTALK_COMMUNITY_URL e CONTALK_COMMUNITY_INTERNAL_TOKEN juntos.')
const authorize=communityUrl?createStorageAuthorizer({url:communityUrl,token:internalToken}):undefined
const server=createStorageServer({directory,key,tokens,publicUrl,authorize,internalToken,
 upload:async({name,size,temporary,fileId})=>{const message=await client.sendFile(channel,{file:new CustomFile(name,size,temporary),forceDocument:true,workers:4,caption:'ConTALK '+fileId});return message.id},
 download:async record=>{const [message]=await client.getMessages(channel,{ids:[record.messageId]});return message?.media?client.iterDownload({file:message.media,requestSize:512*1024}):null},
})
server.listen(Number(process.env.CONTALK_STORAGE_PORT||8788),process.env.CONTALK_STORAGE_HOST||'127.0.0.1',()=>console.log('Armazenamento central pronto.'))