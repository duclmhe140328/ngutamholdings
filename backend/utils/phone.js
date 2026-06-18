const normalizePhone = (value) => {
  let phone = String(value || '').replace(/\D/g, '');
  if (phone.startsWith('84') && phone.length >= 11) phone = `0${phone.slice(2)}`;
  if (!/^0\d{9}$/.test(phone)) return '';
  return phone;
};

module.exports = { normalizePhone };
