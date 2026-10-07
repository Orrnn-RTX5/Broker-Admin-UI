import React from 'react';
import { getLoadedGatewayWorkspace, loadGatewayWorkspace } from '../../utils/gatewayWorkspace.js';

const DeferredGatewayWorkspace = React.lazy(loadGatewayWorkspace);

export default function GatewayWorkspace(props) {
  // A completed preload can render immediately. Keep the chosen component
  // stable for this visit so later parent renders never remount its drafts.
  const [Component] = React.useState(() => getLoadedGatewayWorkspace() || DeferredGatewayWorkspace);
  return <Component {...props} />;
}
