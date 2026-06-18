const money = (value) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const OrderNotificationBell = ({ notifications, open, onToggle, onMarkAllRead, onOpenOrder }) => {
  const unread = notifications.filter((item) => !item.seen).length;

  return (
    <div className="order-notification-wrap">
      <button
        type="button"
        className={`notification-bell ${unread ? 'has-unread' : ''}`}
        onClick={onToggle}
        aria-label={`Thông báo đơn hàng, ${unread} chưa xem`}
      >
        <span aria-hidden="true">🔔</span>
        {unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
      </button>

      {open && (
        <div className="notification-popover">
          <header>
            <div><strong>Đơn hàng mới</strong><small>{unread} thông báo chưa xem</small></div>
            <button type="button" onClick={onMarkAllRead}>Đánh dấu đã đọc</button>
          </header>
          <div className="notification-list">
            {notifications.slice(0, 12).map((item) => (
              <button type="button" className={!item.seen ? 'unread' : ''} key={item.id} onClick={() => onOpenOrder(item)}>
                <span className="notification-icon">{item.tableNumber ? '🍽️' : '🛍️'}</span>
                <span><b>{item.title}</b><small>#{item.orderCode} · {money(item.totalAmount)}</small><time>{new Date(item.createdAt).toLocaleString('vi-VN')}</time></span>
              </button>
            ))}
            {!notifications.length && <div className="notification-empty">Chưa có thông báo đơn mới.</div>}
          </div>
        </div>
      )}
    </div>
  );
};

export default OrderNotificationBell;
