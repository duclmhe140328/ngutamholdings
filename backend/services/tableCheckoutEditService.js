const jwt = require('jsonwebtoken');

const secret = () => process.env.DINING_SESSION_SECRET || process.env.JWT_SECRET || 'dev-dining-session-secret';

const createTableCheckoutEditToken = ({ shopId, tableId, diningSessionId }) => jwt.sign(
  {
    type: 'table_checkout_edit',
    shopId: String(shopId),
    tableId: String(tableId),
    diningSessionId: String(diningSessionId)
  },
  secret(),
  { expiresIn: '15m' }
);

const verifyTableCheckoutEditToken = (token) => {
  try {
    const payload = jwt.verify(String(token || ''), secret());
    return payload.type === 'table_checkout_edit' ? payload : null;
  } catch {
    return null;
  }
};

module.exports = {
  createTableCheckoutEditToken,
  verifyTableCheckoutEditToken
};
