# Admin realtime chat fix v13

This patch updates the seller dashboard so the shop listens for multiple admin chat realtime event names, not only `chat:seller`.

Install:

```powershell
cd "E:\foodhub_v14_5_release\ngutamholdings"
.\install-admin-realtime-fix.cmd
```

Then restart frontend/backend.

If shop still does not receive admin replies until reload, backend is saving messages but not emitting to the shop socket room. In the admin reply route, after saving conversation/message, emit:

```js
io.to(`shop:${conversation.shopId}`).emit('chat:seller', {
  conversation,
  notification: {
    title: 'Admin tổng vừa trả lời',
    body: message.text || conversation.lastMessage
  }
});
```

Use the same room name that your socket connection joins for sellers.
