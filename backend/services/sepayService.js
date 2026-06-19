const crypto = require('crypto');

const normalizeText = (value) => String(value || '').trim();
const normalizeAccount = (value) => normalizeText(value).replace(/\s+/g, '').toUpperCase();

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a || ''));
  const right = Buffer.from(String(b || ''));
  if (!left.length || left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
};

const extractApiKey = (authorization) => {
  const match = String(authorization || '').match(/^Apikey\s+(.+)$/i);
  return match ? match[1].trim() : '';
};

const verifyWebhookApiKey = ({ authorization, globalKey, shopKey }) => {
  const received = extractApiKey(authorization);
  if (!received) return false;
  return (globalKey && safeEqual(received, globalKey)) || (shopKey && safeEqual(received, shopKey));
};

const makePaymentReference = (orderCode) => String(orderCode || '')
  .toUpperCase()
  .replace(/[^A-Z0-9]/g, '')
  .slice(0, 25);

const buildSepayQrUrl = ({ accountNumber, bankName, amount, description, holder, store }) => {
  const params = new URLSearchParams({
    acc: normalizeAccount(accountNumber),
    bank: normalizeText(bankName),
    amount: String(Math.max(0, Math.round(Number(amount || 0)))),
    des: makePaymentReference(description),
    template: 'compact',
    showinfo: 'true',
    fullacc: 'true',
    holder: normalizeText(holder).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase(),
    store: normalizeText(store)
  });
  return `https://qr.sepay.vn/img?${params.toString()}`;
};

const findOrderCodeInPayload = (payload = {}) => {
  const direct = makePaymentReference(payload.code);
  if (/^FH\d{8}[A-Z0-9]{6}$/i.test(direct)) return direct;
  const text = `${payload.content || ''} ${payload.description || ''}`.toUpperCase();
  const match = text.match(/FH\d{8}[A-Z0-9]{6}/);
  return match ? match[0] : '';
};

module.exports = {
  normalizeAccount,
  extractApiKey,
  verifyWebhookApiKey,
  makePaymentReference,
  buildSepayQrUrl,
  findOrderCodeInPayload
};
