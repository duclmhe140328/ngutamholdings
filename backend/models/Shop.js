const mongoose = require('mongoose');

const shopSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },

    businessType: {
      type: String,
      enum: ['restaurant', 'retail'],
      default: 'retail'
    },
    serviceModes: {
      type: [String],
      enum: ['dine_in', 'delivery', 'pickup', 'shipping'],
      default: ['shipping']
    },
    paymentMethods: {
      type: [String],
      enum: ['cash', 'bank_transfer', 'vnpay'],
      default: ['cash']
    },

    bankAccountName: { type: String, default: '', trim: true },
    bankAccountNumber: { type: String, default: '', trim: true },
    bankName: { type: String, default: '', trim: true },

    // Thông tin xuất/hiển thị hóa đơn. Đây là dữ liệu cấu hình của người bán;
    // việc phát hành hóa đơn điện tử hợp pháp cần kết nối nhà cung cấp HĐĐT.
    legalName: { type: String, default: '', trim: true },
    taxCode: { type: String, default: '', trim: true },
    invoiceAddress: { type: String, default: '', trim: true },
    invoiceEmail: { type: String, default: '', trim: true },
    invoicePhone: { type: String, default: '', trim: true },
    defaultVatRate: { type: String, default: '0', trim: true },
    invoiceProviderName: { type: String, default: '', trim: true },
    invoiceLookupUrl: { type: String, default: '', trim: true },

    // Loyalty / xu: 1 xu = 1 VND.
    loyaltyEnabled: { type: Boolean, default: true },
    cashbackPercent: { type: Number, default: 1, min: 0, max: 100 },
    maxCoinUsePercent: { type: Number, default: 50, min: 0, max: 100 },
    dailySpinEnabled: { type: Boolean, default: true },
    spinRewards: { type: [Number], default: [10, 20, 50, 100, 200, 500, 1000, 0] },

    numberOfTables: { type: Number, default: 0, min: 0, max: 500 },

    logoUrl: { type: String, default: '' },
    bannerUrl: { type: String, default: '' },
    backgroundImage1: { type: String, default: '' },
    backgroundImage2: { type: String, default: '' },
    backgroundImage3: { type: String, default: '' },
    description: { type: String, default: '' },
    phone: { type: String, default: '' },
    zalo: { type: String, default: '' },
    address: { type: String, default: '' },
    themeColor: { type: String, default: '#b98745' },
    cuisine: { type: String, default: 'Ẩm thực & mua sắm' },
    deliveryTime: { type: String, default: '25-40 phút' },
    deliveryFee: { type: Number, default: 0 },
    shippingBaseFee: { type: Number, default: 0, min: 0 },
    shippingFeePerKm: { type: Number, default: 0, min: 0 },
    shippingMinFee: { type: Number, default: 0, min: 0 },
    shippingMaxDistanceKm: { type: Number, default: 30, min: 0 },
    shippingDistanceFactor: { type: Number, default: 1.2, min: 1, max: 3 },
    storeLatitude: { type: Number, default: null },
    storeLongitude: { type: Number, default: null },
    storeMapLabel: { type: String, default: '' },
    minOrder: { type: Number, default: 0 },
    rating: { type: Number, default: 4.8, min: 0, max: 5 },

    telegramChatId: { type: String, default: '' },
    zaloWebhookUrl: { type: String, default: '' },
    publicBaseUrl: { type: String, default: '', trim: true },

    // Domain riêng. Chỉ lưu hostname, ví dụ shop.example.com (không có https:// và đường dẫn).
    customDomain: { type: String, default: '', lowercase: true, trim: true },
    customDomainUpdatedAt: { type: Date, default: null },

    // Shop mới phải được admin duyệt trước khi xuất hiện công khai.
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    approvalNote: { type: String, default: '' },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

    isActive: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

// Tra cứu domain nhanh. Tính duy nhất được kiểm tra ở controller để tương thích
// cả MongoDB Atlas lẫn MongoDB local có dữ liệu cũ chứa chuỗi rỗng.
shopSchema.index({ customDomain: 1 });

module.exports = mongoose.model('Shop', shopSchema);
