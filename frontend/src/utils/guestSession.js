import api from '../api/axios.js';

const GUEST_ID_KEY = 'ngutam_guest_id';
const contextKey = (slug, tableToken) => `ngutam_table_session_${slug}_${tableToken}`;

const makeUuid = () => {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `guest-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
};

export const getGuestId = () => {
  let value = localStorage.getItem(GUEST_ID_KEY);
  if (!value) {
    value = makeUuid();
    localStorage.setItem(GUEST_ID_KEY, value);
  }
  return value;
};

export const getDiningContext = (slug, tableToken) => {
  if (!slug || !tableToken) return null;
  try {
    return JSON.parse(localStorage.getItem(contextKey(slug, tableToken)) || 'null');
  } catch {
    return null;
  }
};

export const saveDiningContext = (slug, tableToken, value) => {
  if (!slug || !tableToken || !value) return;
  localStorage.setItem(contextKey(slug, tableToken), JSON.stringify(value));
};

export const clearDiningContext = (slug, tableToken) => {
  if (slug && tableToken) localStorage.removeItem(contextKey(slug, tableToken));
};

export const openOrResumeDiningSession = async ({ slug, tableToken, loyaltyIdentity = null }) => {
  if (!slug || !tableToken) return null;
  const existing = getDiningContext(slug, tableToken);
  const response = await api.post(
    `/dining-sessions/public/${slug}/${tableToken}/open`,
    {
      guestId: getGuestId(),
      guestSessionToken: existing?.guestSessionToken || '',
      loyaltyToken: loyaltyIdentity?.token || ''
    },
    { headers: loyaltyIdentity?.token ? { 'x-loyalty-token': loyaltyIdentity.token } : {} }
  );
  const context = {
    guestId: getGuestId(),
    guestSessionId: response.data.guestSessionId,
    guestSessionToken: response.data.guestSessionToken,
    diningSessionId: response.data.session?._id,
    sessionCode: response.data.session?.sessionCode,
    activeBillNumber: response.data.session?.activeBillNumber || 1,
    table: response.data.table,
    currentBill: response.data.currentBill,
    resumed: Boolean(response.data.resumed),
    verifiedPhone: response.data.verifiedPhone || '',
    updatedAt: Date.now()
  };
  saveDiningContext(slug, tableToken, context);
  return context;
};
