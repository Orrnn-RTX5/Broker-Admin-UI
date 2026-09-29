import {hasPermission,PERMISSION_KEYS} from './permissions.js';

// Reachability uses account viewing, never the unrelated account-edit permission.
export function nativePendingAccountTarget({selected,activeView,accountView,canView,user,scope}){
 if(!scope||!canView||!accountView||selected?.type!=='account'||selected.viewType!==activeView||!hasPermission(user,PERMISSION_KEYS.VIEW_ACCOUNTS))return null;
 const source=selected.row?.raw||selected.row;
 const candidates=[source?.login,source?.Login,source?.account_login,source?.accountLogin,selected.row?.login].filter(value=>value!==undefined&&value!==null&&value!=='');
 if(!candidates.length)return null;
 const exact=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value)?value:typeof value==='number'&&Number.isSafeInteger(value)&&value>0?String(value):null;
 const values=candidates.map(exact);if(values.some(value=>!value)||new Set(values).size!==1||BigInt(values[0])>9223372036854775807n)return null;
 const login=values[0];
 return {login,key:JSON.stringify([scope,activeView,login]),canPlace:hasPermission(user,PERMISSION_KEYS.MANAGE_TRADES),canCancel:hasPermission(user,[PERMISSION_KEYS.MANAGE_TRADES,PERMISSION_KEYS.CLOSE_POSITIONS])};
}
