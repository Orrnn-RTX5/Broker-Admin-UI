import { api } from '../lib/api.js';
import { useAuthStore } from '../store/authStore.js';
import { API_HOST, buildFeedWsUrl } from '../config/endpoints.js';
import { createManagerTradeSocket } from './managerTradeSocket.js';
const authenticated=()=>useAuthStore.getState().accessToken;
const requestTicket=async(login,{signal}={})=>{const response=await api.request({url:'/api/v1/manager/trade-ws-ticket',method:'POST',data:{account_login:login},_noRetry:true,signal});return response.data;};
const getScope=()=>{if(!authenticated())return '';try{const value=JSON.parse(globalThis.sessionStorage?.getItem('auth')||'{}');if(!value.login||typeof value.broker_id!=='string')return '';return JSON.stringify([String(value.login),value.broker_id,value.session_scope||value.created_at||'manager']);}catch{return '';}};
const getTransportScope=()=>{const url=new URL(buildFeedWsUrl());url.search='';url.hash='';url.username='';url.password='';return JSON.stringify([API_HOST,url.origin,url.pathname]);};
export function managerTradeSocketURL(response){
 if(response?.ws_path!=='/ws/manager-trade'||typeof response.ticket!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(response.ticket))throw new Error('Invalid trade socket authorization.');
 const url=new URL(buildFeedWsUrl());url.pathname=response.ws_path;url.search='';url.hash='';url.username='';url.password='';url.searchParams.set('ticket',response.ticket);return url.toString();
}
const client=createManagerTradeSocket({requestTicket,buildUrl:managerTradeSocketURL,getScope,getTransportScope});
// Optional read-only connection preflight. Call before latency-sensitive commands and report its timing separately.
export const warmupManagerTradeSocket=login=>client.warmup(login);
export const placeManagerOrder=payload=>client.place(payload);
export const closeManagerDemoPosition=(ticket,options={})=>client.closeDemo({...options,position_ticket:ticket});
export const listManagerDemoCloses=login=>client.listDemoCloses(login);
export const recoverManagerDemoClose=(login,id)=>client.recoverDemoClose(login,id);
export const listManagerDemoOrders=login=>client.listDemos(login);
export const recoverManagerDemoOrder=(login,id)=>client.recoverDemo(login,id);
export const modifyManagerPosition=(ticket,options={})=>client.modifyPosition({...options,position_ticket:ticket});
export const closeManagerPosition=(ticket,options={})=>client.close({...options,position_ticket:ticket});
export const placeManagerPendingOrder=payload=>client.placePending(payload);
export const listManagerPendingPlacements=login=>client.listPlacements(login);
export const recoverManagerPendingPlacement=(login,id)=>client.recoverPlacement(login,id);
export const cancelManagerPendingOrder=(ticket,options={})=>client.cancelPending({...options,ticket});
export const modifyManagerPendingOrder=(ticket,options={})=>client.modifyPending({...options,ticket});
// Legacy rows only (a fresh read said legacy_modify_available); no expected_version.
export const modifyManagerLegacyPendingOrder=(ticket,options={})=>client.modifyPendingLegacy({...options,ticket});
export const getManagerTradeScope=()=>getScope();
export const peekManagerPendingMutation=(login,ticket)=>client.peekPending(login,ticket);
export const recoverManagerPendingMutation=(login,ticket,id)=>client.recoverPending(login,ticket,id);
export const cancelManagerNativePendingOrder=(ticket,options={})=>client.cancelNativePending({...options,ticket});
export const getManagerOrderStatus=(login,id)=>client.status(login,id);
export default {placeManagerOrder,closeManagerPosition,getManagerOrderStatus,placeManagerPendingOrder,cancelManagerPendingOrder,modifyManagerPendingOrder};
