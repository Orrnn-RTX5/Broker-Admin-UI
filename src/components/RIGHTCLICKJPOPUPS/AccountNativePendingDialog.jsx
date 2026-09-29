import {useEffect,useRef} from 'react';
import {X} from 'lucide-react';
import CustomerNativePending from './CustomerNativePending.jsx';

export default function AccountNativePendingDialog({target,onClose}){
 const closeButton=useRef(null);
 useEffect(()=>{const previous=document.activeElement;closeButton.current?.focus();return()=>previous?.focus?.();},[]);
 const keyDown=event=>{
  if(event.key==='Escape'){event.stopPropagation();onClose();}
  if(event.key==='Tab'){
   const controls=[...event.currentTarget.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter(node=>node.getClientRects().length);
   const first=controls[0],last=controls.at(-1);
   if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
   else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }
 };
 return <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 font-sans">
  <div role="dialog" aria-modal="true" aria-label={'Native pending account '+target.login} onKeyDown={keyDown} className="w-[900px] max-w-[calc(100vw-32px)] max-h-[90vh] bg-[color:var(--bg-surface-1)] border border-[color:var(--border-default)] rounded-[6px] shadow-2xl flex flex-col overflow-hidden" style={{fontSize:11,fontWeight:400}}>
   <div className="flex justify-between items-center px-3 h-8 shrink-0 border-b border-white/5"><span>Native pending — account #{target.login}</span><button type="button" ref={closeButton} onClick={onClose} aria-label="Close native pending" className="p-1 hover:bg-red-500"><X size={14}/></button></div>
   <div className="min-h-0 overflow-auto"><CustomerNativePending key={target.key} login={target.login} canPlace={target.canPlace} canCancel={target.canCancel}/></div>
  </div>
 </div>;
}
