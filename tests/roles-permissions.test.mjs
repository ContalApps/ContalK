import assert from 'node:assert/strict'
import { test } from 'node:test'
import { loadTypescript } from './load-typescript.mjs'
const api=loadTypescript('src/roles/permissions.ts')
function fixture(){const policy=api.initialPolicy('server',['owner','manager','member','peer']);policy.ownerIds=['owner'];const role=(id,position,permissions)=>({...api.everyoneRole(id),position,permissions:api.mask(permissions).toString()});policy.roles.push(role('manager',5,['MANAGE_ROLES','KICK_MEMBERS']),role('member',2,['SEND_MESSAGES']),role('viewer',1,[]));policy.memberRoles={manager:['manager'],member:['member'],peer:['member']};return policy}
test('HQ explicitly starts with all members as co-owners; other servers do not',()=>{
 const hq=api.initialPolicy('srv-1',['alice','bob']);assert.equal(api.isOwner(hq,'alice'),true);assert.equal(api.isOwner(hq,'bob'),true);assert.equal(api.isOwner(hq,'stranger'),false)
 assert.equal(api.isOwner(fixture(),'member'),false)
})
test('role allows combine independently of order; individual channel overwrites are applied last',()=>{
 const p=fixture();p.memberRoles.member=['member','viewer']
 p.overwrites.text=[{id:p.serverId,type:'role',allow:'0',deny:api.mask(['SEND_MESSAGES']).toString()},{id:'member',type:'role',deny:api.mask(['VIEW_CHANNEL']).toString(),allow:'0'},{id:'viewer',type:'role',allow:api.mask(['VIEW_CHANNEL','SEND_MESSAGES']).toString(),deny:'0'}]
 assert.equal(api.can(p,'member','SEND_MESSAGES','text'),true)
 p.roles.reverse();p.memberRoles.member.reverse();assert.equal(api.can(p,'member','SEND_MESSAGES','text'),true)
 p.overwrites.text.push({id:'member',type:'member',deny:api.mask(['SEND_MESSAGES']).toString(),allow:'0'})
 assert.equal(api.can(p,'member','SEND_MESSAGES','text'),false)
 assert.equal(api.can(p,'member','ATTACH_FILES','text'),false)
})
test('administrator bypasses channel restrictions but not hierarchy or managed roles',()=>{
 const p=fixture();p.roles.find(role=>role.id==='manager').permissions=api.mask(['ADMINISTRATOR']).toString()
 p.overwrites.text=[{id:'manager',type:'role',allow:'0',deny:api.ALL_PERMISSIONS.toString()}]
 assert.equal(api.can(p,'manager','VIEW_CHANNEL','text'),true)
 const higher={...api.everyoneRole('higher'),position:10};assert.equal(api.canManageRole(p,'manager',higher),false)
 assert.equal(api.canManageRole(p,'owner',{...higher,managed:'booster'}),false)
 assert.equal(api.canActOnMember(p,'manager','owner','KICK_MEMBERS'),false)
})
test('managers cannot grant missing permissions, assign equal roles or promote untrusted targets',()=>{
 const p=fixture();const low=p.roles.find(role=>role.id==='viewer'),equal=p.roles.find(role=>role.id==='manager')
 assert.equal(api.canAssignRole(p,'manager','member',low),true)
 assert.equal(api.canAssignRole(p,'manager','member',equal),false)
 low.permissions=api.mask(['BAN_MEMBERS']).toString();assert.equal(api.canAssignRole(p,'manager','member',low),false)
 assert.equal(api.canAssignRole(p,'owner','stranger',low),false)
})
test('categories sync only linked channels; role preview ignores ownership; timeouts are separate restrictions',()=>{
 const p=fixture();p.categories=[{id:'category',name:'Equipe'}];p.channelCategories.text={categoryId:'category',synced:true}
 p.overwrites.category=[{id:p.serverId,type:'role',deny:api.mask(['VIEW_CHANNEL']).toString(),allow:'0'}]
 assert.equal(api.can(p,'member','VIEW_CHANNEL','text'),false)
 p.channelCategories.text.synced=false;assert.equal(api.can(p,'member','VIEW_CHANNEL','text'),true)
 p.channelCategories.text.synced=true;assert.equal(api.permissionsFor(p,'owner','text',['member'])&api.Permission.VIEW_CHANNEL,0n)
 p.timeouts.member=Date.now()+60000;p.channelCategories.text.synced=false
 assert.equal(api.can(p,'member','SEND_MESSAGES','text'),false);assert.equal(api.can(p,'member','READ_MESSAGE_HISTORY','text'),true)
})
test('high permission bits survive JSON and unknown flags are rejected',()=>{
 const high=api.mask(['BYPASS_SLOWMODE','SEND_POLLS']);assert.equal(api.readMask(JSON.parse(JSON.stringify(high.toString()))),high)
 assert.throws(()=>api.readMask((1n<<60n).toString()),/desconhecidas/)
})
