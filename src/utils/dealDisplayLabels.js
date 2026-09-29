const DEAL_ACTION_LABELS = {
  deal_buy: 'Buy',
  deal_sell: 'Sell',
};

const DEAL_ENTRY_LABELS = {
  entry_in: 'In',
  entry_out: 'Out',
};

export const formatDealActionLabel = (value) => (
  Object.hasOwn(DEAL_ACTION_LABELS, value) ? DEAL_ACTION_LABELS[value] : value
);

export const formatDealEntryLabel = (value) => (
  Object.hasOwn(DEAL_ENTRY_LABELS, value) ? DEAL_ENTRY_LABELS[value] : value
);
