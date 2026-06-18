const axios = require('axios');

const toRadians = (value) => Number(value) * Math.PI / 180;
const haversineKm = (lat1, lng1, lat2, lng2) => {
  const earth = 6371;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLng / 2) ** 2;
  return earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fetchRoadDistanceKm = async (shopLat, shopLng, customerLat, customerLng) => {
  const base = String(process.env.ROUTING_API_URL || '').replace(/\/$/, '');
  if (!base) return null;
  try {
    const url = `${base}/route/v1/driving/${shopLng},${shopLat};${customerLng},${customerLat}`;
    const response = await axios.get(url, { params: { overview: 'false', alternatives: 'false', steps: 'false' }, timeout: 7000 });
    const meters = Number(response.data?.routes?.[0]?.distance);
    return Number.isFinite(meters) && meters >= 0 ? meters / 1000 : null;
  } catch (error) {
    console.warn('Không lấy được khoảng cách đường đi, dùng ước tính:', error.message);
    return null;
  }
};

const calculateShipping = async (shop, customerLatitude, customerLongitude) => {
  const rawValues = [customerLatitude, customerLongitude, shop.storeLatitude, shop.storeLongitude];
  const customerLat = Number(customerLatitude);
  const customerLng = Number(customerLongitude);
  const shopLat = Number(shop.storeLatitude);
  const shopLng = Number(shop.storeLongitude);
  const hasCoordinates = rawValues.every((value) => value !== '' && value !== null && value !== undefined)
    && [customerLat, customerLng, shopLat, shopLng].every(Number.isFinite);
  if (!hasCoordinates || Number(shop.shippingFeePerKm || 0) <= 0) {
    return { fee: Number(shop.deliveryFee || 0), distanceKm: 0, mode: 'fixed' };
  }

  const roadKm = await fetchRoadDistanceKm(shopLat, shopLng, customerLat, customerLng);
  const factor = Math.max(1, Math.min(3, Number(shop.shippingDistanceFactor || 1.2)));
  const estimatedKm = haversineKm(shopLat, shopLng, customerLat, customerLng) * factor;
  const distanceKm = Math.round((roadKm ?? estimatedKm) * 10) / 10;
  const maxDistance = Number(shop.shippingMaxDistanceKm || 0);
  if (maxDistance > 0 && distanceKm > maxDistance) {
    const error = new Error(`Địa chỉ cách cửa hàng khoảng ${distanceKm} km, vượt phạm vi giao tối đa ${maxDistance} km`);
    error.statusCode = 400;
    throw error;
  }
  const raw = Number(shop.shippingBaseFee || 0) + distanceKm * Number(shop.shippingFeePerKm || 0);
  const fee = Math.max(Number(shop.shippingMinFee || 0), Math.ceil(raw / 1000) * 1000);
  return { fee, distanceKm, mode: roadKm == null ? 'estimated' : 'road' };
};

module.exports = { haversineKm, calculateShipping };
