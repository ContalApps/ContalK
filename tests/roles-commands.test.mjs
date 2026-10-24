import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'
const permissions=loadTypescript('src/roles/permissions.ts')
const {applyRoleCommand:apply}=loadTypescript('src/roles/commands.ts',{'./permissions.ts':permissions})
function fixture(){const policy=permissions.initialPolicy('server',['owner','member']);policy.ownerIds=['owner'];return policy}
test('role lifecycle validates names, preserves immutable input and cleans assignments and channel overwrites',()=>{
 const original=fixture();let policy=apply(original,'owner',{type:'create',id:'new-role',name:'Equipe'})
 assert.equal(original.roles.length,1);assert.equal(policy.roles[1].permissions,'0')
 policy=apply(policy,'owner',{type:'edit',id:'new-role',patch:{color:'#8844ff',mentionable:true,permissions:permissions.mask(['MANAGE_MESSAGES']).toString()}})
 policy=apply(policy,'owner',{type:'assign',id:'new-role',member:'member'})
 policy=apply(policy,'owner',{type:'overwrite',channel:'text',targetId:'new-role',targetType:'role',overwrite:{id:'new-role',type:'role',allow:permissions.mask(['SEND_MESSAGES']).toString(),deny:'0'}})
 assert.equal(policy.memberRoles.member[0],'new-role');assert.equal(policy.overwrites.text.length,1)
 policy=apply(policy,'owner',{type:'delete',id:'new-role'});assert.equal(policy.memberRoles.member.length,0);assert.equal(policy.overwrites.text.length,0)
 assert.throws(()=>apply(policy,'owner',{type:'delete',id:'server'}),/administrar/)
 assert.throws(()=>apply(policy,'owner',{type:'create',id:'invalid',name:'x'.repeat(101)}),/100/)
 assert.throws(()=>apply(policy,'owner',{type:'create',id:'__proto__',name:'Não permitido'}),/Identificador/)
})
test('ordinary members cannot create roles or grant themselves administration',()=>{
 const policy=fixture()
 assert.throws(()=>apply(policy,'member',{type:'create',id:'attack',name:'Admin'}),/permissão/)
 assert.throws(()=>apply(policy,'member',{type:'edit',id:'server',patch:{permissions:permissions.mask(['ADMINISTRATOR']).toString()}}),/permissão/)
})
test('category permissions remain synchronized until a channel is edited and can be re-synchronized',()=>{
 let policy=fixture()
 policy=apply(policy,'owner',{type:'category-create',id:'category',name:'Equipe'})
 policy=apply(policy,'owner',{type:'overwrite',channel:'category',targetId:'server',targetType:'role',overwrite:{id:'server',type:'role',deny:permissions.mask(['SEND_MESSAGES']).toString(),allow:'0'}})
 policy=apply(policy,'owner',{type:'category-link',channel:'text',category:'category',sync:true})
 assert.equal(permissions.can(policy,'member','SEND_MESSAGES','text'),false)
 policy=apply(policy,'owner',{type:'overwrite',channel:'text',targetId:'member',targetType:'member',overwrite:{id:'member',type:'member',allow:permissions.mask(['SEND_MESSAGES']).toString(),deny:'0'}})
 assert.equal(policy.channelCategories.text.synced,false)
 assert.equal(permissions.can(policy,'member','SEND_MESSAGES','text'),true)
 policy=apply(policy,'owner',{type:'category-link',channel:'text',category:'category',sync:true})
 assert.equal(permissions.can(policy,'member','SEND_MESSAGES','text'),false)
})

test('editing a synchronized channel preserves other inherited overwrites',()=>{
 let policy=fixture()
 policy=apply(policy,'owner',{type:'category-create',id:'category',name:'Restrito'})
 policy=apply(policy,'owner',{type:'overwrite',channel:'category',targetId:'server',targetType:'role',overwrite:{id:'server',type:'role',deny:permissions.mask(['VIEW_CHANNEL']).toString(),allow:'0'}})
 policy=apply(policy,'owner',{type:'category-link',channel:'text',category:'category',sync:true})
 policy=apply(policy,'owner',{type:'overwrite',channel:'text',targetId:'member',targetType:'member',overwrite:{id:'member',type:'member',deny:'0',allow:permissions.mask(['SEND_MESSAGES']).toString()}})
 assert.equal(permissions.can(policy,'member','VIEW_CHANNEL','text'),false)
 assert.equal(policy.overwrites.text.length,2)
 assert.equal(policy.overwrites.category.length,1)
})
