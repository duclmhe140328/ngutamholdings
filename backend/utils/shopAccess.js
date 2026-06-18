const normalizeDomain = (value = '') => {
  let input = String(value || '').trim().toLowerCase();
  if (!input) return '';
  try {
    if (!/^https?:\/\//i.test(input)) input = `https://${input}`;
    const url = new URL(input);
    return url.hostname.replace(/^www\./, '').replace(/\.$/, '');
  } catch {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0]
      .split(':')[0]
      .replace(/^www\./, '')
      .replace(/\.$/, '');
  }
};

const getRequestHost = (req) => {
  const forwarded = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const raw = forwarded || req.get('host') || '';
  return normalizeDomain(raw);
};

// Các shop cũ chưa có approvalStatus vẫn được coi là đã duyệt để tránh khóa nhầm dữ liệu đang chạy.
const approvedCondition = {
  $or: [
    { approvalStatus: 'approved' },
    { approvalStatus: { $exists: false } },
    { approvalStatus: null }
  ]
};

const isApproved = (shop) => !shop?.approvalStatus || shop.approvalStatus === 'approved';

module.exports = { normalizeDomain, getRequestHost, approvedCondition, isApproved };
