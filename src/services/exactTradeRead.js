import {api} from '../lib/api.js';
import {createExactTradeReader} from './exactTradeCapability.js';

// Fresh authoritative single-row reads for account-trade Modify and SL/TP gates.
const request=async(path,signal)=>(await api.get(path,{signal,_noRetry:true})).data;
// Dev-only notice when the running Manager backend predates the row-read routes
// and the reader falls back to the pre-A5 legacy behavior for this session.
const onRouteAbsent=import.meta.env?.DEV?({kind,status})=>console.warn(`[exactTradeRead] GET /api/v1/manager/accounts/{login}/${kind}/{ticket} answered HTTP ${status} (route absent). Using the pre-A5 legacy fallback for ${kind} for this session: legacy Modify/SL-TP available, exact path unavailable. Rebuild the Manager backend, then reload.`):undefined;
export const exactTradeReader=createExactTradeReader({request,onRouteAbsent});
