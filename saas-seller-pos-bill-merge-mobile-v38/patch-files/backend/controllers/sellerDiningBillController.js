const {
  assertSellerSession,
  getEditorPayload,
  previewSellerBill,
  settleSellerBill
} = require('../services/sellerDiningBillService');

exports.getEditor = async (req, res, next) => {
  try {
    const { session, shop } = await assertSellerSession({ sessionId: req.params.id, user: req.user });
    return res.json(await getEditorPayload({ session, shop }));
  } catch (error) {
    return next(error);
  }
};

exports.preview = async (req, res, next) => {
  try {
    const { session, shop } = await assertSellerSession({ sessionId: req.params.id, user: req.user });
    if (session.status === 'closed') return res.status(400).json({ message: 'Phiên bàn đã đóng' });
    const result = await previewSellerBill({
      session,
      shop,
      items: req.body.items,
      couponCode: req.body.couponCode,
      loyaltyPhone: req.body.loyaltyPhone
    });
    return res.json({
      products: result.products,
      subtotal: result.subtotal,
      couponCode: result.couponCode,
      couponDiscount: result.couponDiscount,
      couponTitle: result.couponTitle,
      couponKind: result.couponKind,
      totalAmount: result.totalAmount
    });
  } catch (error) {
    return next(error);
  }
};

exports.settle = async (req, res, next) => {
  try {
    const { session, shop } = await assertSellerSession({ sessionId: req.params.id, user: req.user });
    const result = await settleSellerBill({ session, shop, user: req.user, payload: req.body || {} });
    return res.json(result);
  } catch (error) {
    return next(error);
  }
};
