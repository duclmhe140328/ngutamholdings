import React, { useEffect, useMemo, useRef, useState } from 'react';
import Pagination from './Pagination.jsx';
import { 
  Search, X, ChevronLeft, Send, 
  MessageSquare, CircleDot, User 
} from 'lucide-react';

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

  const choose = (thread) => {
    onSelect(thread);
    setMobileThreadOpen(true);
  };

  const goBackToList = () => {
    setMobileThreadOpen(false);
  };

  const submit = () => {
    if (!String(replyValue || '').trim()) return;
    if (!active && !allowEmptyReply) return;
    onReply(active?._id || null);
  };

  return (
    <>
      <style>{`
        :root {
          --cw-gold: #f59e0b;
          --cw-gold-light: #fef3c7;
          --cw-dark: #0f172a;
          --cw-bg: #f8fafc;
          --cw-bg-input: #f1f5f9;
          --cw-border: #e2e8f0;
          --cw-text-main: #334155;
          --cw-text-light: #64748b;
          --cw-red: #ef4444;
          --cw-green: #10b981;
        }

        .chat-workspace {
          display: flex;
          width: 100%;
          height: 100%; 
          max-height: 100%; /* CHỐNG PHÌNH TO */
          min-height: 0; 
          background: #fff;
          font-family: system-ui, -apple-system, sans-serif;
          position: relative;
          overflow: hidden; /* Cắt mọi thứ tràn ra ngoài */
          border-radius: inherit;
        }

        /* --- CỘT TRÁI: DANH SÁCH --- */
        .chat-list-panel {
          width: 320px; 
          flex-shrink: 0;
          border-right: 1px solid var(--cw-border);
          display: flex;
          flex-direction: column;
          background: #fff;
          height: 100%;
          overflow: hidden; /* CHỐNG PHÌNH TO */
        }

        .chat-list-tools {
          padding: 20px 16px 12px 16px;
          background: #fff;
          display: flex;
          flex-direction: column;
          gap: 16px;
          flex-shrink: 0;
        }

        .cw-search { position: relative; display: flex; align-items: center; }
        .cw-search-icon { position: absolute; left: 14px; color: #94a3b8; }
        .cw-search input {
          width: 100%; padding: 12px 36px 12px 42px; border: 1px solid var(--cw-border);
          border-radius: 99px; font-size: 13px; outline: none; transition: border-color 0.2s; background: var(--cw-bg-input);
        }
        .cw-search input:focus { border-color: var(--cw-gold); background: #fff; box-shadow: 0 0 0 3px rgba(245,158,11,0.1); }
        .cw-clear-btn { position: absolute; right: 12px; background: #e2e8f0; border: none; color: #64748b; cursor: pointer; display: flex; padding: 4px; border-radius: 50%; }
        .cw-clear-btn:hover { background: #cbd5e1; }

        .switch-filter { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--cw-text-main); cursor: pointer; user-select: none;}
        .switch-filter input[type="checkbox"] { accent-color: var(--cw-gold); width: 16px; height: 16px; cursor: pointer; }

        .chat-list-scroll {
          flex: 1; 
          overflow-y: auto; 
          padding: 8px 12px; 
          display: flex; 
          flex-direction: column; 
          gap: 6px;
          min-height: 0;
        }
        .chat-list-scroll::-webkit-scrollbar { width: 6px; }
        .chat-list-scroll::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 6px; }
        .chat-list-scroll:hover::-webkit-scrollbar-thumb { background: #cbd5e1; }

        .chat-list-loading { text-align: center; padding: 20px; color: var(--cw-text-light); font-size: 13px; font-weight: 500;}

        .conversation-list-item {
          background: #fff; border: 1px solid transparent; border-radius: 16px; padding: 12px 14px;
          display: flex; gap: 14px; align-items: center; cursor: pointer; transition: all 0.2s;
          text-align: left; position: relative; flex-shrink: 0;
        }
        .conversation-list-item:hover { background: var(--cw-bg); }
        .conversation-list-item.active { background: var(--cw-gold-light); border-color: transparent; }
        
        .conversation-avatar {
          width: 48px; height: 48px; background: #e2e8f0; border-radius: 50%; display: flex;
          align-items: center; justify-content: center; font-weight: 700; color: var(--cw-text-main); font-size: 16px; overflow: hidden; flex-shrink: 0; border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.05);
        }
        .conversation-avatar img { width: 100%; height: 100%; object-fit: cover; }
        .conversation-avatar.large { width: 44px; height: 44px; border: 2px solid #fff; box-shadow: 0 2px 8px rgba(0,0,0,0.08);}

        .conversation-preview { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;}
        .conversation-preview > span { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; }
        .conversation-preview b { font-size: 15px; color: var(--cw-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 700;}
        .conversation-preview time { font-size: 11px; color: var(--cw-text-light); flex-shrink: 0; margin-left: 8px; font-weight: 500;}
        .conversation-preview small { font-size: 12px; color: var(--cw-text-light); margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .conversation-preview p { font-size: 13px; color: var(--cw-text-main); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        
        .conversation-list-item.unread .conversation-preview b { color: var(--cw-dark); font-weight: 800; }
        .conversation-list-item.unread .conversation-preview p { color: var(--cw-dark); font-weight: 700; }

        .cw-unread-dot {
          position: absolute; right: 14px; top: 50%; transform: translateY(-50%);
          width: 10px; height: 10px; background: var(--cw-gold); border-radius: 50%;
          box-shadow: 0 0 0 3px #fff;
        }

        .empty-chat-list { text-align: center; padding: 40px 20px; color: var(--cw-text-light); }
        .empty-chat-list svg { margin-bottom: 12px; opacity: 0.3; }
        .empty-chat-list b { display: block; font-size: 15px; color: var(--cw-dark); margin-bottom: 6px; }
        .empty-chat-list p { font-size: 13px; margin: 0; }

        .chat-list-pagination { padding: 12px 16px; border-top: 1px solid var(--cw-border); flex-shrink: 0; background: #fff; }

        /* --- CỘT PHẢI: KHUNG CHAT CHÍNH --- */
        .chat-thread-panel {
          flex: 1; 
          display: flex; 
          flex-direction: column; 
          background: var(--cw-bg); 
          height: 100%;
          min-width: 0;
          overflow: hidden; /* CHỐNG PHÌNH TO BỀ DỌC */
        }

        .chat-thread-head {
          padding: 16px 24px; background: #fff; border-bottom: 1px solid var(--cw-border);
          display: flex; align-items: center; gap: 16px; flex-shrink: 0; box-shadow: 0 4px 20px rgba(0,0,0,0.02); z-index: 10;
        }
        
        .chat-mobile-back {
          display: none; background: transparent; border: none; color: var(--cw-text-main);
          width: 40px; height: 40px; border-radius: 50%; align-items: center; justify-content: center; cursor: pointer; transition: background 0.2s; flex-shrink: 0; margin-left: -8px;
        }
        .chat-mobile-back:active { background: var(--cw-bg-input); }

        .chat-thread-head > div { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center;}
        .chat-thread-head h3 { font-size: 16px; font-weight: 800; color: var(--cw-dark); margin: 0 0 2px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .chat-thread-head p { font-size: 13px; color: var(--cw-text-light); margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;}
        
        .chat-online-dot { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: var(--cw-green); padding: 4px 12px; background: #dcfce7; border-radius: 999px; flex-shrink: 0; border: 1px solid #bbf7d0;}

        /* Vùng hiển thị tin nhắn */
        .chat-message-stream {
          flex: 1; 
          overflow-y: auto; 
          padding: 24px 32px; 
          background: transparent;
          display: flex; 
          flex-direction: column; 
          gap: 16px;
          min-height: 0; /* Ép sinh thanh cuộn, không cho phình */
        }
        .chat-message-stream::-webkit-scrollbar { width: 6px; }
        .chat-message-stream::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 6px; }

        .chat-row { display: flex; flex-direction: column; max-width: 75%; flex-shrink: 0; }
        .chat-row.mine { align-self: flex-end; align-items: flex-end; }
        .chat-row.theirs { align-self: flex-start; align-items: flex-start; }

        .chat-bubble { display: flex; flex-direction: column; }
        .chat-bubble small { font-size: 11px; color: var(--cw-text-light); margin-bottom: 6px; font-weight: 600; }
        .chat-row.mine .chat-bubble small { text-align: right; }
        
        .chat-bubble p {
          padding: 12px 18px; font-size: 14.5px; line-height: 1.5; border-radius: 20px;
          margin: 0; word-break: break-word; box-shadow: 0 2px 4px rgba(0,0,0,0.03);
        }
        .chat-row.mine .chat-bubble p { background: var(--cw-gold); color: #fff; border-bottom-right-radius: 4px; }
        .chat-row.theirs .chat-bubble p { background: #fff; color: var(--cw-dark); border-bottom-left-radius: 4px; border: 1px solid var(--cw-border); }

        .chat-bubble time { font-size: 11px; color: #94a3b8; margin-top: 6px; font-weight: 500;}
        .chat-row.mine .chat-bubble time { text-align: right; }

        /* --- VÙNG GÕ VĂN BẢN (THẲNG HÀNG & CHỐNG LẸM ĐÁY) --- */
        .chat-composer {
          padding: 20px 32px; 
          background: #fff; 
          border-top: 1px solid var(--cw-border);
          display: flex; 
          gap: 16px; 
          align-items: center; /* CHẮC CHẮN GIỮ NÚT VÀ Ô TEXT THẲNG HÀNG */
          flex-shrink: 0; /* KHÔNG BAO GIỜ BỊ CO LẠI HAY ĐẨY ĐI */
          z-index: 10;
          width: 100%;
          box-sizing: border-box;
        }
        .fhc-textarea-wrapper {
          flex: 1; /* Cho phép giãn hết chiều rộng */
          display: flex;
          min-width: 0;
        }
        .chat-composer textarea {
          width: 100%;
          height: 48px; /* Khóa cứng chiều cao */
          padding: 13px 20px;
          border: 1px solid var(--cw-border); 
          border-radius: 24px; 
          font-size: 15px;
          font-family: inherit; 
          resize: none; 
          outline: none; 
          box-sizing: border-box; 
          background: var(--cw-bg-input); 
          transition: all 0.2s; 
          line-height: 22px;
          margin: 0;
        }
        .chat-composer textarea:focus { background: #fff; border-color: var(--cw-gold); box-shadow: 0 0 0 4px rgba(245,158,11,0.1); }
        .chat-composer button {
          width: 48px; 
          height: 48px; /* Khóa cứng chiều cao bằng với textarea */
          background: var(--cw-dark); 
          color: #fff; 
          border: none;
          border-radius: 50%; 
          display: flex; 
          align-items: center; 
          justify-content: center; 
          cursor: pointer; 
          transition: all 0.2s; 
          flex-shrink: 0; 
          box-shadow: 0 4px 10px rgba(15,23,42,0.15);
          margin: 0;
          padding: 0;
        }
        .chat-composer button:hover:not(:disabled) { background: var(--cw-gold); transform: translateY(-2px); box-shadow: 0 6px 15px rgba(245,158,11,0.25); }
        .chat-composer button:disabled { background: var(--cw-border); color: #94a3b8; cursor: not-allowed; box-shadow: none; }

        .chat-thread-empty {
          flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
          background: transparent; text-align: center; padding: 40px; min-height: 0;
        }
        .chat-thread-empty svg { color: #cbd5e1; margin-bottom: 20px; width: 80px; height: 80px; stroke-width: 1.5; }
        .chat-thread-empty h3 { font-size: 22px; font-weight: 800; color: var(--cw-dark); margin: 0 0 10px 0; }
        .chat-thread-empty p { font-size: 15px; color: var(--cw-text-light); margin: 0; max-width: 400px; line-height: 1.6;}

        /* =========================================
           🚀 RESPONSIVE MOBILE FIX TẬN GỐC
           ========================================= */
        @media (max-width: 768px) {
          
          /* Ở TRẠNG THÁI MẶC ĐỊNH (CHƯA MỞ CHAT) */
          .chat-list-panel {
            width: 100%;
            border-right: none;
            display: flex; 
          }
          .chat-thread-panel { display: none; }

          /* KHI BẤM CHỌN 1 NGƯỜI */
          .chat-workspace.thread-open .chat-list-panel { display: none; }
          .chat-workspace.thread-open .chat-thread-panel {
            display: flex; 
            width: 100%;
            height: 100%;
            flex-direction: column;
            position: absolute; /* Tách khỏi layout gốc, đè chặt mọi thứ */
            top: 0; left: 0; right: 0; bottom: 0;
            background: #fff;
            z-index: 100;
          }

          .chat-mobile-back { display: flex; } 
          
          .chat-thread-head { padding: 12px 16px; gap: 12px; }
          .chat-online-dot { display: none; } 
          
          .chat-message-stream { 
             padding: 16px; 
             flex: 1;
             overflow-y: auto;
             min-height: 0;
          }
          .chat-row { max-width: 90%; }
          
          /* ÉP CHẶT XUỐNG ĐÁY */
          .chat-composer { 
             padding: 12px 16px; 
             background: #fff;
             border-top: 1px solid var(--cw-border);
             margin-top: auto;
             gap: 10px;
          }
          .fhc-textarea-wrapper { flex: 1; display: flex; min-width: 0;}
          .chat-composer textarea { 
            font-size: 16px !important; /* Chống iOS tự Zoom */
            border-radius: 22px; 
            height: 44px; 
            padding: 11px 16px; 
            width: 100%;
          }
          .chat-composer button { border-radius: 50%; width: 44px; height: 44px; }
        }
      `}</style>

      <section className={`chat-workspace ${mobileThreadOpen ? 'thread-open' : ''}`}>
        
        {/* --- CỘT TRÁI: DANH SÁCH KHÁCH HÀNG --- */}
        <aside className="chat-list-panel">
          <div className="chat-list-tools">
            <div className="cw-search">
              <Search size={18} className="cw-search-icon" />
              <input 
                value={search} 
                onChange={(event) => onSearchChange(event.target.value)} 
                placeholder="Tìm tên, SĐT, nội dung..." 
              />
              {search && (
                <button type="button" className="cw-clear-btn" onClick={() => onSearchChange('')} aria-label="Xóa tìm kiếm">
                  <X size={14}/>
                </button>
              )}
            </div>
            <label className="switch-filter">
              <input type="checkbox" checked={unreadOnly} onChange={(event) => onUnreadOnlyChange(event.target.checked)} />
              Chỉ hiện tin chưa đọc
            </label>
          </div>

          <div className="chat-list-scroll">
            {loading && <div className="chat-list-loading">Đang tải hội thoại...</div>}
            
            {!loading && conversations.map((thread) => {
              const unread = Number(thread[unreadField] || 0);
              const title = titleFor(thread);
              return (
                <button 
                  type="button" 
                  key={thread._id} 
                  className={`conversation-list-item ${activeId === thread._id ? 'active' : ''} ${unread ? 'unread' : ''}`} 
                  onClick={() => choose(thread)}
                >
                  <span className="conversation-avatar">
                    {thread.shopId?.logoUrl ? <img src={thread.shopId.logoUrl} alt="" /> : <User size={24} strokeWidth={1.5}/>}
                  </span>
                  
                  <span className="conversation-preview">
                    <span>
                      <b>{title}</b>
                      <time>{formatTime(thread.updatedAt)}</time>
                    </span>
                    <small>{subtitleFor(thread)}</small>
                    <p>{thread.lastMessage || 'Chưa có nội dung'}</p>
                  </span>
                  
                  {unread > 0 && <span className="cw-unread-dot" title={`${unread} tin chưa đọc`}></span>}
                </button>
              );
            })}
            
            {!loading && !conversations.length && (
              <div className="empty-chat-list">
                <MessageSquare size={48} strokeWidth={1} />
                <b>{emptyTitle}</b>
                <p>{emptyText}</p>
              </div>
            )}
          </div>
          <div className="chat-list-pagination">
             <Pagination pagination={pagination} onPageChange={onPageChange} compact />
          </div>
        </aside>

        {/* --- CỘT PHẢI: KHUNG NHẮN TIN --- */}
        <article className="chat-thread-panel">
          {active ? (
            <>
              <header className="chat-thread-head">
                <button type="button" className="chat-mobile-back" onClick={goBackToList} aria-label="Quay lại danh sách">
                  <ChevronLeft size={28} />
                </button>

                <span className="conversation-avatar large">
                  {active.shopId?.logoUrl ? <img src={active.shopId.logoUrl} alt="" /> : <User size={20}/>}
                </span>
                <div>
                  <h3>{titleFor(active)}</h3>
                  <p>{subtitleFor(active)}</p>
                </div>
                <span className="chat-online-dot"><CircleDot size={14}/> Realtime</span>
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
                <div className="fhc-textarea-wrapper">
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
                </div>
                <button type="button" onClick={submit} disabled={!String(replyValue || '').trim()} aria-label="Gửi tin nhắn">
                  <Send size={22} style={{marginLeft: '-2px', marginTop: '2px'}}/>
                </button>
              </footer>
            </>
          ) : allowEmptyReply ? (
            <>
              <header className="chat-thread-head">
                <button type="button" className="chat-mobile-back" onClick={goBackToList} aria-label="Quay lại danh sách">
                  <ChevronLeft size={28} />
                </button>
                <div style={{fontWeight: 800, color: '#0f172a', fontSize: '16px'}}>Trò chuyện mới</div>
              </header>
              <div className="chat-thread-empty">
                <MessageSquare />
                <h3>{emptyTitle}</h3>
                <p>{emptyText}</p>
              </div>
              <footer className="chat-composer">
                <div className="fhc-textarea-wrapper">
                  <textarea 
                    value={replyValue || ''} 
                    onChange={(event) => onReplyChange(event.target.value)} 
                    placeholder="Nhập tin nhắn để bắt đầu..." 
                    onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit(); } }} 
                  />
                </div>
                <button type="button" onClick={submit} disabled={!String(replyValue || '').trim()} aria-label="Gửi tin nhắn">
                  <Send size={22} style={{marginLeft: '-2px', marginTop: '2px'}}/>
                </button>
              </footer>
            </>
          ) : (
            <div className="chat-thread-empty">
              <MessageSquare />
              <h3>Chọn một cuộc trò chuyện</h3>
              <p>Danh sách tin nhắn từ khách hàng sẽ hiển thị tại đây và được cập nhật theo thời gian thực.</p>
            </div>
          )}
        </article>
      </section>
    </>
  );
};

export default ConversationWorkspace;