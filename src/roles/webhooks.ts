export interface CommunityWebhook {id:string;channelId:string;name:string;creator:string;createdAt:number;updatedAt:number}
export type WebhookCommand={type:'create';channelId:string;name:string}|{type:'edit';id:string;name:string}|{type:'rotate'|'delete';id:string}
export interface WebhookResult {webhook:CommunityWebhook;token?:string}
