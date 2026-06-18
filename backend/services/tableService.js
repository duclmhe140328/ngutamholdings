const crypto = require('crypto');
const DiningTable = require('../models/DiningTable');

const makeToken = () => crypto.randomBytes(12).toString('hex');

const syncDiningTables = async (shop) => {
  const shouldHaveTables = shop.businessType === 'restaurant' && shop.serviceModes.includes('dine_in');
  const count = shouldHaveTables ? Math.max(0, Number(shop.numberOfTables || 0)) : 0;

  const existing = await DiningTable.find({ shopId: shop._id }).sort({ tableNumber: 1 });
  const byNumber = new Map(existing.map((item) => [item.tableNumber, item]));
  const operations = [];

  for (let tableNumber = 1; tableNumber <= count; tableNumber += 1) {
    const found = byNumber.get(tableNumber);
    if (found) {
      if (!found.isActive || found.name !== `Bàn ${tableNumber}`) {
        found.isActive = true;
        found.name = `Bàn ${tableNumber}`;
        operations.push(found.save());
      }
    } else {
      operations.push(
        DiningTable.create({
          shopId: shop._id,
          tableNumber,
          name: `Bàn ${tableNumber}`,
          qrToken: makeToken(),
          isActive: true
        })
      );
    }
  }

  existing
    .filter((item) => item.tableNumber > count && item.isActive)
    .forEach((item) => {
      item.isActive = false;
      operations.push(item.save());
    });

  await Promise.all(operations);
  return DiningTable.find({ shopId: shop._id }).sort({ tableNumber: 1 });
};

module.exports = { syncDiningTables, makeToken };
