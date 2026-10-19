export const GROUP_PARENT_LOOKUP_DEBOUNCE_MS = 400;

// A missing parent group is a valid state (the user is typing a new parent
// path), not an error worth surfacing or logging.
export const isGroupLookupNotFound = (error) => (
  Number(error?.response?.status ?? error?.status) === 404
);
