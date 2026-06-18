const crypto = require('crypto');
const querystring = require('querystring');

const formatVnpDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(date).reduce((acc, part) => {
    if (part.type !== 'literal') acc[part.type] = part.value;
    return acc;
  }, {});
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
};

const normalizeIp = (value) => {
  const ip = String(value || '127.0.0.1').split(',')[0].trim();
  if (ip === '::1') return '127.0.0.1';
  return ip.replace(/^::ffff:/, '');
};

const sortAndEncode = (input) => Object.keys(input)
  .sort()
  .reduce((result, key) => {
    result[encodeURIComponent(key)] = encodeURIComponent(input[key]).replace(/%20/g, '+');
    return result;
  }, {});

const signParams = (params, secret) => {
  const sorted = sortAndEncode(params);
  const signData = querystring.stringify(sorted, '&', '=', { encodeURIComponent: (value) => value });
  return crypto.createHmac('sha512', secret).update(Buffer.from(signData, 'utf-8')).digest('hex');
};

const createPaymentUrl = (order, ipAddress) => {
  const tmnCode = process.env.VNP_TMN_CODE;
  const secret = process.env.VNP_HASH_SECRET;
  const baseUrl = process.env.VNP_URL || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  const returnUrl = process.env.VNP_RETURN_URL;
  if (!tmnCode || !secret || !returnUrl) return '';

  const params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: tmnCode,
    vnp_Amount: Math.round(Number(order.totalAmount) * 100),
    vnp_CurrCode: 'VND',
    vnp_TxnRef: order.orderCode,
    vnp_OrderInfo: `Thanh toan don hang ${order.orderCode}`,
    vnp_OrderType: 'other',
    vnp_Locale: 'vn',
    vnp_ReturnUrl: returnUrl,
    vnp_IpAddr: normalizeIp(ipAddress),
    vnp_CreateDate: formatVnpDate()
  };

  const sorted = sortAndEncode(params);
  sorted.vnp_SecureHash = signParams(params, secret);
  return `${baseUrl}?${querystring.stringify(sorted, '&', '=', { encodeURIComponent: (value) => value })}`;
};

const verifyReturn = (query) => {
  const secret = process.env.VNP_HASH_SECRET;
  if (!secret) return false;
  const cloned = { ...query };
  const received = cloned.vnp_SecureHash;
  delete cloned.vnp_SecureHash;
  delete cloned.vnp_SecureHashType;
  const expected = signParams(cloned, secret);
  if (!received || received.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
};

module.exports = { createPaymentUrl, verifyReturn };
