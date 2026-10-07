let pending;
let loaded;
export const getLoadedGatewayWorkspace = () => loaded?.default;
export const loadGatewayWorkspace = () => {
  if (!pending) pending = import('../components/organisms/GatewaysView.jsx').then(module => {
    loaded = module;
    return module;
  }).catch(error => {
    pending = null;
    throw error;
  });
  return pending;
};
