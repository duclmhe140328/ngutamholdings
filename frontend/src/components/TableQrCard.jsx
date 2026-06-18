import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { buildTableOrderUrl } from '../utils/publicAppUrl.js';

const TableQrCard = ({ table, shop, onRegenerate, onToggle }) => {
  const [dataUrl, setDataUrl] = useState('');
  const publicUrl = useMemo(() => buildTableOrderUrl({
    slug: shop.slug,
    tableToken: table.qrToken,
    shopPublicBaseUrl: shop.publicBaseUrl,
    customDomain: shop.customDomain
  }), [shop.slug, shop.publicBaseUrl, shop.customDomain, table.qrToken]);

  useEffect(() => {
    QRCode.toDataURL(publicUrl, { width: 420, margin: 2, errorCorrectionLevel: 'H' })
      .then(setDataUrl)
      .catch(() => setDataUrl(''));
  }, [publicUrl]);

  const printQr = () => {
    const popup = window.open('', '_blank', 'width=520,height=720');
    if (!popup) return;
    popup.document.write(`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${shop.name} - ${table.name}</title><style>
      body{font-family:Arial,sans-serif;text-align:center;padding:28px;color:#17130d}.sheet{border:2px solid #b98745;border-radius:28px;padding:28px}img{width:320px;max-width:100%}h1{font-size:28px;margin:8px 0}h2{font-size:42px;margin:8px 0;color:#8a632e}p{font-size:17px;line-height:1.5}.url{font-size:11px;word-break:break-all;color:#666}
    </style></head><body><div class="sheet"><h1>${shop.name}</h1><h2>${table.name}</h2><p>Quét mã để xem thực đơn và gọi món tại bàn</p><img src="${dataUrl}"/><p class="url">${publicUrl}</p></div><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(publicUrl);
    } catch {
      window.prompt('Sao chép đường dẫn QR:', publicUrl);
    }
  };

  return (
    <article className={`table-qr-card ${!table.isActive ? 'is-disabled' : ''}`}>
      <div className="table-qr-top">
        <span className="table-number">{String(table.tableNumber).padStart(2, '0')}</span>
        <span className={`status-dot ${table.isActive ? 'online' : ''}`}>{table.isActive ? 'Đang dùng' : 'Đã khóa'}</span>
      </div>
      <h3>{table.name}</h3>
      {dataUrl ? <img src={dataUrl} alt={`QR ${table.name}`} /> : <div className="qr-loading">Đang tạo QR...</div>}
      <small>{publicUrl}</small>
      <div className="table-qr-actions">
        <button type="button" className="btn-gold" onClick={printQr}>In QR</button>
        <button type="button" className="btn-ghost" onClick={copyLink}>Copy link</button>
        <button type="button" className="btn-ghost" onClick={() => onRegenerate(table._id)}>Đổi mã</button>
        <button type="button" className="btn-ghost" onClick={() => onToggle(table)}>{table.isActive ? 'Khóa' : 'Mở'}</button>
      </div>
    </article>
  );
};

export default TableQrCard;
