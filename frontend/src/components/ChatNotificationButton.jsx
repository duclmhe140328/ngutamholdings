const ChatNotificationButton = ({ unread = 0, onClick, label = 'Tin nhắn' }) => (
  <button
    type="button"
    className={`chat-notification-button ${unread ? 'has-unread' : ''}`}
    onClick={onClick}
    aria-label={`${label}, ${unread} tin chưa đọc`}
    title={label}
  >
    <span aria-hidden="true">💬</span>
    {unread > 0 && <b>{unread > 99 ? '99+' : unread}</b>}
  </button>
);

export default ChatNotificationButton;
