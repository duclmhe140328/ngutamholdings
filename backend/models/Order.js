const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    name: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    image: { type: String, default: '' }
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    orderCode: { type: String, required: true, unique: true, index: true },
    shopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Shop', required: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningTable', default: null },
    tableNumber: { type: Number, default: null },
    diningSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'DiningSession', default: null, index: true },
    guestSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'GuestSession', default: null, index: true },
    billNumber: { type: Number, default: 1, min: 1, index: true },
    orderRound: { type: Number, default: 1, min: 1 },
    orderType: {
      type: String,
      enum: ['dine_in', 'delivery', 'pickup', 'shipping'],
      required: true
    },
    customerName: { type: String, required: true, trim: true },
    phone: { type: String, default: '', trim: true },
    address: { type: String, default: '', trim: true },
    note: { type: String, default: '' },
    products: { type: [orderItemSchema], required: true },
    subtotal: { type: Number, required: true, min: 0 },
    deliveryFee: { type: Number, default: 0, min: 0 },
    deliveryDistanceKm: { type: Number, default: 0, min: 0 },
    customerLatitude: { type: Number, default: null },
    customerLongitude: { type: Number, default: null },
    shopLatitude: { type: Number, default: null },
    shopLongitude: { type: Number, default: null },
    couponCode: { type: String, default: '', trim: true, uppercase: true },
    couponDiscount: { type: Number, default: 0, min: 0 },
    customerVoucherId: { type: mongoose.Schema.Types.ObjectId, ref: 'CustomerVoucher', default: null },
    platformCouponId: { type: mongoose.Schema.Types.ObjectId, ref: 'PlatformCoupon', default: null },
    loyaltyPhone: { type: String, default: '', trim: true },
    coinsUsed: { type: Number, default: 0, min: 0 },
    shopCoinsUsed: { type: Number, default: 0, min: 0 },
    platformCoinsUsed: { type: Number, default: 0, min: 0 },
    coinDiscount: { type: Number, default: 0, min: 0 },
    loyaltyRewardCoins: { type: Number, default: 0, min: 0 },
    loyaltyRewardedAt: { type: Date, default: null },
    benefitsReleasedAt: { type: Date, default: null },
    totalAmount: { type: Number, required: true, min: 0 },
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank_transfer', 'vnpay', 'pay_later'],
      default: 'cash'
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'pending', 'partial', 'paid', 'failed', 'refunded'],
      default: 'unpaid'
    },
    paidAt: { type: Date, default: null },
    paymentReference: { type: String, default: '', trim: true, uppercase: true, index: true },
    bankQrUrl: { type: String, default: '' },
    bankReceivedAmount: { type: Number, default: 0, min: 0 },
    sepayTransactionId: { type: String, default: '', trim: true },
    sepayReferenceCode: { type: String, default: '', trim: true },
    sepayGateway: { type: String, default: '', trim: true },
    paymentUpdatedAt: { type: Date, default: null },
    vnpayTransactionNo: { type: String, default: '', trim: true },
    vnpayBankCode: { type: String, default: '', trim: true },

    // Dữ liệu mẫu in hóa đơn/phiếu tính tiền có tách thuế GTGT.
    // Không tự phát hành hóa đơn điện tử có mã của cơ quan thuế.
    invoiceStatus: {
      type: String,
      enum: ['not_issued', 'draft', 'external_issued', 'cancelled'],
      default: 'not_issued',
      index: true
    },
    invoiceNumber: { type: String, default: '', trim: true },
    invoiceSymbol: { type: String, default: '', trim: true },
    invoiceTemplateCode: { type: String, default: '', trim: true },
    invoiceLookupCode: { type: String, default: '', trim: true },
    invoiceLookupUrl: { type: String, default: '', trim: true },
    invoiceProviderName: { type: String, default: '', trim: true },
    invoiceIssuedAt: { type: Date, default: null },
    buyerName: { type: String, default: '', trim: true },
    buyerCompanyName: { type: String, default: '', trim: true },
    buyerTaxCode: { type: String, default: '', trim: true },
    buyerAddress: { type: String, default: '', trim: true },
    buyerEmail: { type: String, default: '', trim: true },
    vatRate: { type: String, default: '0', trim: true },
    amountBeforeVat: { type: Number, default: 0, min: 0 },
    vatAmount: { type: Number, default: 0, min: 0 },
    invoiceTotal: { type: Number, default: 0, min: 0 },
    invoiceNote: { type: String, default: '' },
    invoiceUpdatedAt: { type: Date, default: null },

    status: {
      type: String,
      enum: ['pending', 'confirmed', 'preparing', 'ready', 'serving', 'shipping', 'completed', 'cancelled'],
      default: 'pending'
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Order', orderSchema);
