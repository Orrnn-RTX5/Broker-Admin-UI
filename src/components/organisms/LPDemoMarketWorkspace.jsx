import {useAuthStore} from '../../store/authStore.js';
import LPDemoMarketPanel from './LPDemoMarketPanel.jsx';
export default function LPDemoMarketWorkspace(){
 const session=useAuthStore(state=>state.accessToken);
 return session?<LPDemoMarketPanel key={session} sessionKey={session}/>:null;
}
