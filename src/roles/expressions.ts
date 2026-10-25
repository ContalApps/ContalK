import {can,type RolePolicy} from './permissions.ts'
import type {Attachment} from '../store/useAppStore'
export type ExpressionKind='emoji'|'sticker'
export interface CommunityExpression{id:string;serverId:string;kind:ExpressionKind;name:string;creator:string;createdAt:number;updatedAt:number;attachment:Attachment}
export interface ExpressionReference{serverId:string;id:string}
export interface ExpressionLibrary{serverId:string;name:string;revision:number;canCreate:boolean;items:Array<CommunityExpression&{canManage:boolean}>}
export const canManageExpression=(policy:RolePolicy,actor:string,item:CommunityExpression)=>can(policy,actor,'MANAGE_GUILD_EXPRESSIONS')||item.creator===actor&&can(policy,actor,'CREATE_GUILD_EXPRESSIONS')
export function expressionName(value:unknown):string{if(typeof value!=='string')throw new Error('Informe um nome para a expressão.');const name=value.trim().normalize('NFC');if(!/^[\p{L}\p{N}_-]{2,32}$/u.test(name))throw new Error('Use de 2 a 32 letras, números, hífens ou sublinhados.');return name}
