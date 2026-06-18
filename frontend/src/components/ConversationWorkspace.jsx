import { useEffect, useMemo, useRef, useState } from 'react';
import Pagination from './Pagination.jsx';

const formatTime = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const today = new Date();
  const sameDay = date.toDateString() === today.toDateString();
  return new Intl.DateTimeFormat('vi-VN', sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }
  ).format(date);
};

const initials = (value = '') => value.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase() || 'FH';

const ConversationWorkspace = ({
  conversations = [],
  viewerRole,
  activeId,
  onSelect,
  onReply,
  replyValue,
  onReplyChange,
  search,
  onSearchChange,
  unreadOnly,
  onUnreadOnlyChange,
  pagination,
  onPageChange,
  titleFor,
  subtitleFor,
  unreadField,
  emptyTitle = 'Chưa có cuộc trò chuyện',
  emptyText = 'Tin nhắn mới sẽ xuất hiện ở đây.',
  loading = false,
  allowEmptyReply = false
}) => {
  const [mobileThreadOpen, setMobileThreadOpen] = useState(false);
  const endRef = useRef(null);
  const active = useMemo(() => conversations.find((item) => item._id === activeId) || null, [conversations, activeId]);

  useEffect(() => {
    if (active) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [active?._id, active?.messages?.length]);

  useEffect(() => {
    if (!activeId) return;
    if (window.matchMedia?.('(max-width: 900px)').matches) setMobileThreadOpen(true);
  }, [activeId]);

  const choose = (thread) => {
    onSelect(thread);
    setMobileThreadOpen(true);
  };

  const submit = () => {
    if (!String(replyValue || '').trim()) return;
    if (!active && !allowEmptyReply) return;
    onReply(active?._id || null);
  };

  return (
    <section className={`chat-workspace ${(mobileThreadOpen || (allowEmptyReply && !conversations.length)) ? 'thread-open' : ''}`}>
      <aside className="chat-list-panel">
        <div className="chat-list-tools">
          <div className="filter-search compact-search">
            <span aria-hidden="true">⌕</span>
            <input value={search} onChange={(event) => onSearchChange(event.target.value)} placeholder="Tìm tên, số điện thoại, nội dung..." />
            {search && <button type="button" onClick={() => onSearchChange('')} aria-label="Xóa tìm kiếm">×</button>}
          </div>
          <label className="switch-filter">
            <input type="checkbox" checked={unreadOnly} onChange={(event) => onUnreadOnlyChange(event.target.checked)} />
            <span /> Chưa đọc
          </label>
        </div>

        <div className="chat-list-scroll">
          {loading && <div className="chat-list-loading">Đang tải hội thoại...</div>}
          {!loading && conversations.map((thread) => {
            const unread = Number(thread[unreadField] || 0);
            const title = titleFor(thread);
            return (
              <button type="button" key={thread._id} className={`conversation-list-item ${activeId === thread._id ? 'active' : ''} ${unread ? 'unread' : ''}`} onClick={() => choose(thread)}>
                <span className="conversation-avatar">{thread.shopId?.logoUrl ? <img src={thread.shopId.logoUrl} alt="" /> : initials(title)}</span>
                <span className="conversation-preview">
                  <span><b>{title}</b><time>{formatTime(thread.updatedAt)}</time></span>
                  <small>{subtitleFor(thread)}</small>
                  <p>{thread.lastMessage || 'Chưa có nội dung'}</p>
                </span>
                {unread > 0 && <em>{unread > 99 ? '99+' : unread}</em>}
              </button>
            );
          })}
          {!loading && !conversations.length && <div className="empty-chat-list"><span>✦</span><b>{emptyTitle}</b><p>{emptyText}</p></div>}
        </div>
        <Pagination pagination={pagination} onPageChange={onPageChange} compact />
      </aside>

      <article className="chat-thread-panel">
        {active ? (
          <>
            <header className="chat-thread-head">
              <button type="button" className="chat-mobile-back" onClick={() => setMobileThreadOpen(false)} aria-label="Quay lại danh sách hội thoại"><span>←</span><b>Danh sách</b></button>
              <span className="conversation-avatar large">{active.shopId?.logoUrl ? <img src={active.shopId.logoUrl} alt="" /> : initials(titleFor(active))}</span>
              <div><h3>{titleFor(active)}</h3><p>{subtitleFor(active)}</p></div>
              <span className="chat-online-dot">● Realtime</span>
            </header>
            <div className="chat-message-stream">
              {(active.messages || []).map((message) => {
                const mine = message.senderRole === viewerRole;
                return (
                  <div key={message._id || `${message.createdAt}-${message.text}`} className={`chat-row ${mine ? 'mine' : 'theirs'}`}>
                    <div className="chat-bubble">
                      <small>{mine ? 'Bạn' : message.senderName || 'Người gửi'}</small>
                      <p>{message.text}</p>
                      <time>{formatTime(message.createdAt)}</time>
                    </div>
                  </div>
                );
              })}
              <div ref={endRef} />
            </div>
            <footer className="chat-composer">
              <textarea
                value={replyValue || ''}
                onChange={(event) => onReplyChange(event.target.value)}
                placeholder="Nhập tin nhắn..."
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    submit();
                  }
                }}
              />
              <button type="button" onClick={submit} disabled={!String(replyValue || '').trim()} aria-label="Gửi tin nhắn">➤</button>
            </footer>
          </>
        ) : allowEmptyReply ? (
          <>
            <div className="chat-thread-empty"><span>✦</span><h3>{emptyTitle}</h3><p>{emptyText}</p></div>
            <footer className="chat-composer">
              <textarea value={replyValue || ''} onChange={(event) => onReplyChange(event.target.value)} placeholder="Nhập tin nhắn để bắt đầu..." onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} />
              <button type="button" onClick={submit} disabled={!String(replyValue || '').trim()} aria-label="Gửi tin nhắn">➤</button>
            </footer>
          </>
        ) : (
          <div className="chat-thread-empty"><span>✦</span><h3>Chọn một cuộc trò chuyện</h3><p>Nội dung hội thoại sẽ hiển thị tại đây và được cập nhật theo thời gian thực.</p></div>
        )}
      </article>
    </section>
  );
};

export default ConversationWorkspace;
