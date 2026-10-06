export const nativePendingLabels = Object.freeze({
 awaiting_native_confirmation:'Awaiting native confirmation',
 working:'Native working; customer unfilled',
 native_partial_customer_unfilled:'Native partially executed; customer unfilled',
 unknown:'Native outcome unknown',
 held:'Reconciliation hold',
 native_full_awaiting_settlement:'Native full execution; awaiting customer settlement',
 customer_filled:'Customer filled',
 cancelled:'Customer cancelled',rejected:'Customer rejected',expired:'Customer expired'
});
const id=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value)&&BigInt(value)<=9223372036854775807n;
const decimal=value=>typeof value==='string'&&/^[0-9]+(\.[0-9]+)?$/.test(value)&&value.length<=80;
export function validateCustomerPendingPage(value){
 if(!value||!Array.isArray(value.orders)||value.orders.length>100||typeof value.truncated!=='boolean')throw Error('Invalid pending response.');
 const seen=new Set();
 const orders=value.orders.map(row=>{
 if(!row||row.execution_owner!=='lp_native'||!id(row.command_id)||!id(row.revision)||typeof row.client_order_id!=='string'||!row.client_order_id||row.client_order_id.length>128||seen.has(row.command_id)||(row.order_ticket!==null&&!id(row.order_ticket))||!['buy_limit','sell_limit','buy_stop','sell_stop'].includes(row.order_type)||typeof row.symbol!=='string'||!row.symbol||row.symbol.length>128||!['pending','filled','rejected'].includes(row.customer_status)||!Object.hasOwn(nativePendingLabels,row.display_state)||typeof row.reconciliation_required!=='boolean'||row.controls_available!==false||(row.cancel_available!==undefined&&typeof row.cancel_available!=='boolean')||![row.raw_customer_volume,row.customer_lots,row.customer_price].every(decimal)||(row.expiry!==null&&(!Number.isSafeInteger(row.expiry)||row.expiry<=0||row.expiry>253402300799)))throw Error('Invalid pending order.');
 if((row.display_state==='customer_filled')!==(row.customer_status==='filled'))throw Error('Conflicting customer fill state.');
 seen.add(row.command_id);
 return {...Object.fromEntries(['execution_owner','command_id','client_order_id','order_ticket','revision','symbol','order_type','raw_customer_volume','customer_lots','customer_price','expiry','customer_status','display_state','reconciliation_required','controls_available'].map(key=>[key,row[key]])),cancel_available:row.cancel_available===true};
 });
 return {orders,truncated:value.truncated};
}
