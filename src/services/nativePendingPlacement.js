import {listManagerPendingPlacements,recoverManagerPendingPlacement,placeManagerPendingOrder} from './managerTradeApi.js';
import {nativePendingCancel} from './nativePendingCancel.js';
import {api} from '../lib/api.js';
export const nativePendingPlacement={
 scope:login=>nativePendingCancel.scope(login),
 subscribe(listener){const stop=nativePendingCancel.subscribe(listener);window.addEventListener('rtx:pending-placement-changed',listener);return()=>{stop?.();window.removeEventListener('rtx:pending-placement-changed',listener);};},
 list:login=>listManagerPendingPlacements(login),
 recover:(login,id)=>recoverManagerPendingPlacement(login,id),
 check:async(draft,{signal}={})=>(await api.post('/api/v1/manager/accounts/'+encodeURIComponent(String(draft.account_login))+'/native-pending-placement-advisory',draft,{signal,_noRetry:true,headers:{'Cache-Control':'no-store'}})).data,
 place:draft=>placeManagerPendingOrder(draft),
 isTerminal:error=>nativePendingCancel.isTerminal(error),
};
