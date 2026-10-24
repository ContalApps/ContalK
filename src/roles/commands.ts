import { CHANNEL_PERMISSIONS, can, canActOnMember, canAssignRole, canRemoveRole, canGrant, canManageRole, everyoneRole, highestPosition, isOwner, readMask, type Overwrite, type Role, type RolePolicy } from './permissions.ts'
type Appearance=Pick<Role,'name'|'color'|'secondaryColor'|'style'|'icon'|'hoist'|'mentionable'>
export type RoleCommand=
  | {type:'create';id:string;name:string}
  | {type:'edit';id:string;patch:Partial<Appearance&Pick<Role,'permissions'>>}
  | {type:'delete';id:string}
  | {type:'move';id:string;position:number}
  | {type:'assign'|'remove';id:string;member:string}
  | {type:'overwrite';channel:string;overwrite:Overwrite|null;targetId:string;targetType:'role'|'member'}
  | {type:'category-create';id:string;name:string}
  | {type:'category-delete';id:string}
  | {type:'category-link';channel:string;category:string|null;sync:boolean}
  | {type:'timeout';member:string;until:number}
const idPattern=/^[\w:-]{1,100}$/
function id(value:string){if(typeof value!=='string'||!idPattern.test(value)||['__proto__','constructor','prototype'].includes(value))throw new Error('Identificador inválido.');return value}
function name(value:string){if(typeof value!=='string'||!value.trim()||value.trim().length>100)throw new Error('Use um nome entre 1 e 100 caracteres.');return value.trim()}
function requirePermission(policy:RolePolicy,actor:string,permission:Parameters<typeof can>[2],channel?:string){if(!can(policy,actor,permission,channel))throw new Error('Você não tem permissão para realizar esta ação.')}
export function applyRoleCommand(current:RolePolicy,actor:string,command:RoleCommand,now=Date.now()):RolePolicy {
  if(!current.members.includes(actor)&&!isOwner(current,actor))throw new Error('O usuário não pertence ao servidor.')
  const next:RolePolicy=JSON.parse(JSON.stringify(current))
  const find=(roleId:string)=>{const role=next.roles.find(role=>role.id===id(roleId));if(!role)throw new Error('Cargo não encontrado.');return role}
  const manageable=(roleId:string)=>{const role=find(roleId);if(!canManageRole(current,actor,role))throw new Error('Não é possível administrar este cargo: confira a hierarquia e a origem do cargo.');return role}
  switch(command.type){
    case 'create':{
      requirePermission(current,actor,'MANAGE_ROLES')
      if(next.roles.length>=250)throw new Error('O servidor atingiu o limite de 250 cargos.')
      if(next.roles.some(role=>role.id===id(command.id)))throw new Error('Este cargo já existe.')
      for(const role of next.roles)if(role.position>0)role.position++
      next.roles.push({...everyoneRole(command.id),name:name(command.name),position:1,permissions:'0'})
      return next
    }
    case 'edit':{
      const role=command.id===next.serverId?find(command.id):manageable(command.id)
      if(role.id===next.serverId)requirePermission(current,actor,'MANAGE_ROLES')
      for(const key of Object.keys(command.patch))if(!['name','color','secondaryColor','style','icon','hoist','mentionable','permissions'].includes(key))throw new Error('Propriedade de cargo inválida.')
      if(command.patch.name!==undefined){if(role.id===next.serverId)throw new Error('O nome @everyone é fixo.');role.name=name(command.patch.name)}
      if(command.patch.permissions!==undefined){readMask(command.patch.permissions);if(!canGrant(current,actor,command.patch.permissions))throw new Error('Você não pode conceder permissões que não possui.');role.permissions=command.patch.permissions}
      for(const key of ['color','secondaryColor'] as const)if(command.patch[key]!==undefined){const value=command.patch[key];if(value!==null&&!/^#[0-9a-f]{6}$/i.test(value!))throw new Error('Cor inválida.');role[key]=value??null}
      if(command.patch.style!==undefined){if(!['solid','gradient','holographic'].includes(command.patch.style))throw new Error('Estilo inválido.');role.style=command.patch.style}
      if(command.patch.icon!==undefined){const icon=command.patch.icon;if(icon!==null&&!(typeof icon==='string'&&(icon.length<=16||(icon.length<=32000&&/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(icon)))))throw new Error('Use um emoji ou uma imagem compacta para o ícone.');role.icon=icon}
      for(const key of ['hoist','mentionable'] as const)if(command.patch[key]!==undefined){if(typeof command.patch[key]!=='boolean')throw new Error('Opção de cargo inválida.');role[key]=command.patch[key]!}
      if(role.id===next.serverId){role.hoist=false;role.mentionable=false;role.color=null;role.secondaryColor=null;role.icon=null}
      return next
    }
    case 'delete':{
      manageable(command.id);next.roles=next.roles.filter(role=>role.id!==command.id)
      for(const member of Object.keys(next.memberRoles))next.memberRoles[member]=next.memberRoles[member].filter(roleId=>roleId!==command.id)
      for(const channel of Object.keys(next.overwrites))next.overwrites[channel]=next.overwrites[channel].filter(overwrite=>overwrite.type!=='role'||overwrite.id!==command.id)
      next.roles.sort((a,b)=>a.position-b.position).forEach((role,index)=>role.position=index)
      return next
    }
    case 'move':{
      const role=manageable(command.id)
      if(!Number.isInteger(command.position)||command.position<1||command.position>=next.roles.length||(!isOwner(current,actor)&&command.position>=highestPosition(current,actor)))throw new Error('Posição não permitida para este cargo.')
      const ordered=next.roles.filter(r=>r.id!==next.serverId&&r.id!==role.id).sort((a,b)=>a.position-b.position)
      ordered.splice(command.position-1,0,role);ordered.forEach((r,index)=>r.position=index+1)
      if(!isOwner(current,actor)&&role.position>=highestPosition(next,actor))throw new Error('A nova ordem ultrapassaria seu cargo mais alto.')
      return next
    }
    case 'assign':case 'remove':{
      const role=find(command.id),target=id(command.member)
      if(!current.members.includes(target))throw new Error('Membro não encontrado.')
      if(!(command.type==='assign'?canAssignRole(current,actor,target,role):canRemoveRole(current,actor,target,role)))throw new Error('A atribuição não é permitida pela hierarquia ou pelas permissões.')
      const assigned=new Set(next.memberRoles[target]||[])
      if(command.type==='assign')assigned.add(role.id);else assigned.delete(role.id)
      next.memberRoles[target]=[...assigned];return next
    }
    case 'overwrite':{
      requirePermission(current,actor,'MANAGE_ROLES',command.channel);id(command.channel);id(command.targetId)
      if(!['role','member'].includes(command.targetType))throw new Error('Destino de permissão inválido.')
      if(command.targetType==='role')find(command.targetId);else if(!next.members.includes(command.targetId))throw new Error('Membro não encontrado.')
      const link=next.channelCategories[command.channel]
      const inherited=link?.synced?next.overwrites[link.categoryId]:next.overwrites[command.channel]
      const previous=(inherited||[]).find(overwrite=>overwrite.id===command.targetId&&overwrite.type===command.targetType)
      if(previous&&!canGrant(current,actor,(readMask(previous.allow)|readMask(previous.deny)).toString()))throw new Error('Você não pode remover permissões que não possui.')
      const entries=(inherited||[]).filter(overwrite=>overwrite.id!==command.targetId||overwrite.type!==command.targetType)
      if(command.overwrite){
        if(command.overwrite.id!==command.targetId||command.overwrite.type!==command.targetType)throw new Error('Destino de permissão inconsistente.')
        const allow=readMask(command.overwrite.allow),deny=readMask(command.overwrite.deny)
        if(((allow|deny)&~CHANNEL_PERMISSIONS)!==0n)throw new Error('Esta permissão é exclusiva do servidor.')
        if((allow&deny)!==0n)throw new Error('Uma permissão não pode ser permitida e negada ao mesmo tempo.')
        if(!canGrant(current,actor,(allow|deny).toString()))throw new Error('Você não pode alterar permissões que não possui.')
        entries.push({...command.overwrite})
      }
      next.overwrites[command.channel]=entries
      if(next.channelCategories[command.channel])next.channelCategories[command.channel].synced=false
      return next
    }
    case 'category-create':{
      requirePermission(current,actor,'MANAGE_CHANNELS');id(command.id)
      if(next.categories.some(category=>category.id===command.id))throw new Error('Esta categoria já existe.')
      next.categories.push({id:command.id,name:name(command.name)});return next
    }
    case 'category-delete':{
      requirePermission(current,actor,'MANAGE_CHANNELS');id(command.id)
      next.categories=next.categories.filter(category=>category.id!==command.id)
      for(const [channel,link]of Object.entries(next.channelCategories))if(link.categoryId===command.id){if(link.synced)next.overwrites[channel]=next.overwrites[command.id]||[];delete next.channelCategories[channel]}
      delete next.overwrites[command.id];return next
    }
    case 'category-link':{
      requirePermission(current,actor,'MANAGE_CHANNELS');id(command.channel)
      if(command.category===null){const link=next.channelCategories[command.channel];if(link?.synced)next.overwrites[command.channel]=next.overwrites[link.categoryId]||[];delete next.channelCategories[command.channel];return next}
      if(!next.categories.some(category=>category.id===id(command.category!)))throw new Error('Categoria não encontrada.')
      if(command.sync)requirePermission(current,actor,'MANAGE_ROLES')
      next.channelCategories[command.channel]={categoryId:command.category,synced:command.sync===true};return next
    }
    case 'timeout':{
      if(!canActOnMember(current,actor,command.member,'MODERATE_MEMBERS')||can(current,command.member,'ADMINISTRATOR'))throw new Error('Você não pode moderar este membro.')
      if(!Number.isSafeInteger(command.until)||(command.until!==0&&(command.until<=now||command.until>now+28*24*60*60*1000)))throw new Error('Use um prazo futuro de até 28 dias.')
      if(command.until===0)delete next.timeouts[command.member];else next.timeouts[command.member]=command.until
      return next
    }
    default:throw new Error('Operação de cargo desconhecida.')
  }
}
