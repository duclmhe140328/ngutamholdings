const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema(
  {
    senderRole: {
      type: String,
      enum: ['customer', 'seller', 'admin'],
      required: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    senderName: {
      type: String,
      default: ''
    },
    text: {
      type: String,
      required: true,
      trim: true
    }
  },
  { timestamps: true }
);

const conversationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['customer_shop', 'shop_admin'],
      required: true
    },
    shopId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Shop',
      required: true
    },
    customerSessionId: {
      type: String,
      default: ''
    },
    customerName: {
      type: String,
      default: ''
    },
    customerPhone: {
      type: String,
      default: ''
    },
    subject: {
      type: String,
      default: 'Tin nhắn mới'
    },
    messages: {
      type: [messageSchema],
      default: []
    },
    lastMessage: {
      type: String,
      default: ''
    },
    lastSenderRole: {
      type: String,
      default: ''
    },
    unreadForSeller: {
      type: Number,
      default: 0
    },
    unreadForAdmin: {
      type: Number,
      default: 0
    },
    unreadForCustomer: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open'
    }
  },
  { timestamps: true }
);


conversationSchema.index({ shopId: 1, type: 1, updatedAt: -1 });
conversationSchema.index({ type: 1, updatedAt: -1 });
conversationSchema.index({ shopId: 1, customerSessionId: 1, status: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
