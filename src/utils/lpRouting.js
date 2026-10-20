// An internal (B-book) route is identified ONLY by explicit backend metadata:
// is_internal_route or routing_mode === 'b_book'. Route display names and
// route values are tenant data and must never decide execution routing.
export const isInternalRouteOption = (option) => Boolean(option && (
  option.is_internal_route || option.routing_mode === 'b_book'
));

export const selectRouteOption = (form, option) => ({
  ...form,
  lp_name: option?.route_value || option?.name || '',
  routing_mode: option
    ? (isInternalRouteOption(option) ? 'b_book' : (form.routing_mode === 'hybrid' ? 'hybrid' : 'a_book'))
    : form.routing_mode,
});

export const selectRoutingMode = (form, mode, options) => {
  const current = options.find((option) => (option.route_value || option.name) === form.lp_name);
  const compatible = current && isInternalRouteOption(current) === (mode === 'b_book');
  const internal = options.find(isInternalRouteOption);
  return {
    ...form,
    routing_mode: mode,
    lp_name: compatible ? form.lp_name : (mode === 'b_book' ? (internal?.route_value || internal?.name || '') : ''),
  };
};
