import {getManagerTradeScope,peekManagerPendingMutation,recoverManagerPendingMutation,cancelManagerNativePendingOrder} from './managerTradeApi.js';
export const nativePendingCancel={
 scope(login){const scope=getManagerTradeScope();return scope&&/^[1-9][0-9]*$/.test(String(login))?JSON.stringify([scope,String(login)]):'';},
 subscribe(listener){const events=['auth:session-expired','auth:token-updated','storage','focus'];events.forEach(event=>window.addEventListener(event,listener));return()=>events.forEach(event=>window.removeEventListener(event,listener));},
 peek:(login,ticket)=>peekManagerPendingMutation(login,ticket),
 recover:(login,ticket,id)=>recoverManagerPendingMutation(login,ticket,id),
 cancel:(login,ticket)=>cancelManagerNativePendingOrder(ticket,{account_login:login}),
 isTerminal:error=>['rejected','expired'].includes(error.commandStatus),
};