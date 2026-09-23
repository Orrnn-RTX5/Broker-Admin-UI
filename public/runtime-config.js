// Deploy-time override. Takes precedence over the VITE_* values baked into the
// bundle (see src/config/runtimeConfig.js), so it must match the target broker.
window.__RTX5_RUNTIME_CONFIG__ = window.__RTX5_RUNTIME_CONFIG__ || {
  SUPER_ADMIN_API_HOST: "https://superadmin-prod.orrnn.com"
};
