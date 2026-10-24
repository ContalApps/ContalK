import fs from 'node:fs'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const validMember=value=>typeof value==='string'&&/^[\w:-]{1,100}$/.test(value)&&!['__proto__','constructor','prototype'].includes(value)
const validDomain=value=>typeof value==='string'&&value.length<=253&&value.includes('.')&&value.split('.').every(label=>/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label))

// Never rotates or replaces a deployment's existing personal keys.
export function prepareCommunityDeployment({directory='.community-deploy',members,domain=''}) {
  if(!Array.isArray(members)||!members.length||members.some(member=>!validMember(member)))throw new Error('Informe pelo menos um username ConTALK válido com --member.')
  if(domain&&!validDomain(domain))throw new Error('Informe somente o domínio, sem protocolo, porta ou caminho.')
  const target=path.resolve(directory)
  if(fs.existsSync(target))throw new Error('O diretório já existe. Preserve a configuração atual; use um diretório novo para outra instalação.')
  const tokens=Object.fromEntries([...new Set(members)].map(member=>[randomBytes(32).toString('hex'),member]))
  const environment=[
    '# ConTALK Community — configuração privada da VPS',
    '# O domínio pode ser preenchido depois; sem ele, use somente o serviço local.',
    `CONTALK_COMMUNITY_DOMAIN=${domain.toLowerCase()}`,
    'CONTALK_COMMUNITY_HOST=127.0.0.1',
    'CONTALK_COMMUNITY_PORT=8789',
    'CONTALK_COMMUNITY_DATA=.community-data',
    `CONTALK_COMMUNITY_TOKENS='${JSON.stringify(tokens)}'`,
    `CONTALK_COMMUNITY_INTERNAL_TOKEN=${randomBytes(32).toString('hex')}`,
    '# Credenciais LiveKit privadas, somente no servidor:',
    'CONTALK_COMMUNITY_LIVEKIT_URL=',
    'CONTALK_COMMUNITY_LIVEKIT_API_KEY=',
    'CONTALK_COMMUNITY_LIVEKIT_API_SECRET=',
    '# Opcional: serviço de arquivos com a mesma chave interna:',
    'CONTALK_COMMUNITY_STORAGE_URL=',
    '',
  ].join('\n')
  fs.mkdirSync(target,{mode:0o700})
  fs.writeFileSync(path.join(target,'.env'),environment,{flag:'wx',mode:0o600})
  const access=Object.entries(tokens).map(([token,username])=>({username,url:domain?'https://'+domain.toLowerCase():'',token}))
  fs.writeFileSync(path.join(target,'access.json'),JSON.stringify(access,null,2)+'\n',{flag:'wx',mode:0o600})
  return {directory:target,members:access.length}
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    const members=[],options={members}
    for(let index=2;index<process.argv.length;index++){
      const flag=process.argv[index],value=process.argv[++index]
      if(!value||value.startsWith('--'))throw new Error('Use --member username (repetível), --domain domínio (opcional) e --directory caminho (opcional).')
      if(flag==='--member')members.push(value)
      else if(flag==='--domain')options.domain=value
      else if(flag==='--directory')options.directory=value
      else throw new Error('Opção desconhecida: '+flag)
    }
    const result=prepareCommunityDeployment(options)
    console.log(`Configuração preparada em ${result.directory} para ${result.members} conta(s).`)
    console.log('O endereço pode ser informado depois. As chaves individuais estão no arquivo privado access.json; não publique esse arquivo.')
  }catch(error){console.error(error.message);process.exitCode=1}
}
