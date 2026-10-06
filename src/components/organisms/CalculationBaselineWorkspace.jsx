import {useAuthStore} from '../../store/authStore.js';
import CalculationBaselinePanel from './CalculationBaselinePanel.jsx';
import CalculationCutoverPanel from './CalculationCutoverPanel.jsx';
export default function CalculationBaselineWorkspace(){
 const session=useAuthStore(state=>state.accessToken);
 const user=useAuthStore(state=>state.user);
 return session&&(user?.is_admin===true||user?.role==='admin')?<>
  <CalculationBaselinePanel key={'baseline:'+session} sessionKey={session}/>
  <CalculationCutoverPanel key={'cutover:'+session} sessionKey={session}/>
 </>:null;
}
