const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parsePagination = (query = {}, defaults = {}) => {
  const defaultLimit = Number(defaults.defaultLimit || 12);
  const maxLimit = Number(defaults.maxLimit || 100);
  const page = clamp(Number.parseInt(query.page, 10) || 1, 1, 1000000);
  const limit = clamp(Number.parseInt(query.limit, 10) || defaultLimit, 1, maxLimit);
  return { page, limit, skip: (page - 1) * limit };
};

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildPagination = ({ page, limit, total }) => ({
  page,
  limit,
  total,
  totalPages: Math.max(1, Math.ceil(total / limit)),
  hasNext: page * limit < total,
  hasPrev: page > 1
});

const parseDateRange = (query = {}, field = 'createdAt') => {
  const range = {};
  if (query.dateFrom) {
    const start = new Date(query.dateFrom);
    if (!Number.isNaN(start.getTime())) range.$gte = start;
  }
  if (query.dateTo) {
    const end = new Date(query.dateTo);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
  }
  return Object.keys(range).length ? { [field]: range } : {};
};

module.exports = { parsePagination, buildPagination, escapeRegex, parseDateRange };
