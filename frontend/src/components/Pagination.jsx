const Pagination = ({ pagination, onPageChange, compact = false }) => {
  if (!pagination || Number(pagination.total || 0) <= 0) return null;
  const page = Number(pagination.page || 1);
  const totalPages = Math.max(1, Number(pagination.totalPages || 1));
  const total = Number(pagination.total || 0);
  const limit = Number(pagination.limit || total || 1);
  const from = total ? ((page - 1) * limit) + 1 : 0;
  const to = Math.min(page * limit, total);
  const pages = [];
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let value = start; value <= end; value += 1) pages.push(value);

  return (
    <div className={`pagination-shell ${compact ? 'compact' : ''}`}>
      <span className="pagination-summary">Hiển thị {from}–{to} / {total} bản ghi · Trang {page}/{totalPages}</span>
      <nav className={`pagination ${compact ? 'compact' : ''}`} aria-label="Phân trang">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Trang trước">‹</button>
        {start > 1 && <><button type="button" onClick={() => onPageChange(1)}>1</button>{start > 2 && <span>…</span>}</>}
        {pages.map((value) => (
          <button type="button" key={value} className={value === page ? 'active' : ''} onClick={() => onPageChange(value)}>{value}</button>
        ))}
        {end < totalPages && <>{end < totalPages - 1 && <span>…</span>}<button type="button" onClick={() => onPageChange(totalPages)}>{totalPages}</button></>}
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Trang sau">›</button>
      </nav>
    </div>
  );
};

export default Pagination;
