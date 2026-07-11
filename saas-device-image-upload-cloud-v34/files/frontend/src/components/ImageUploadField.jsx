import { useMemo, useRef, useState } from 'react';
import api from '../api/axios.js';

const parseValue = (value) => {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
};

const unique = (items) => Array.from(new Set(items.filter(Boolean)));

const ImageUploadField = ({
  label,
  value,
  onChange,
  multiple = false,
  maxFiles = 8,
  kind = 'general',
  placeholder = 'https://...',
  help = 'Có thể dán link ảnh hoặc chọn ảnh trực tiếp từ điện thoại/máy tính.'
}) => {
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const images = useMemo(() => parseValue(value), [value]);

  const commit = (next) => {
    const clean = unique(next).slice(0, multiple ? maxFiles : 1);
    onChange(multiple ? clean.join('\n') : (clean[0] || ''));
  };

  const upload = async (event) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (!selected.length) return;

    setUploading(true);
    setError('');
    setMessage('');
    try {
      const data = new FormData();
      selected.slice(0, multiple ? maxFiles : 1).forEach((file) => data.append('images', file));
      data.append('kind', kind);

      const response = await api.post('/uploads/images', data, {
        timeout: 120000,
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      const uploaded = Array.isArray(response.data?.urls) ? response.data.urls : [];
      commit(multiple ? [...images, ...uploaded] : uploaded);
      setMessage(response.data?.warning || `Đã tải lên ${uploaded.length} ảnh`);
    } catch (uploadError) {
      setError(uploadError.message || 'Tải ảnh thất bại');
    } finally {
      setUploading(false);
    }
  };

  const removeAt = (index) => commit(images.filter((_, itemIndex) => itemIndex !== index));

  return (
    <div className="fh-input-group" style={{ minWidth: 0 }}>
      {label && <label>{label}</label>}
      {multiple ? (
        <textarea
          rows="3"
          value={String(value || '')}
          onChange={(event) => onChange(event.target.value)}
          placeholder={`${placeholder}\nMỗi link một dòng`}
        />
      ) : (
        <input
          value={String(value || '')}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        multiple={multiple}
        hidden
        onChange={upload}
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          className="fh-btn-outline"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          style={{ minHeight: 40, padding: '8px 13px' }}
        >
          {uploading ? 'Đang tải ảnh...' : multiple ? 'Chọn ảnh trong máy' : 'Tải ảnh từ máy'}
        </button>
        {!!images.length && (
          <button
            type="button"
            className="fh-btn-outline"
            disabled={uploading}
            onClick={() => commit([])}
            style={{ minHeight: 40, padding: '8px 13px' }}
          >
            Xóa ảnh
          </button>
        )}
      </div>

      <small style={{ color: '#64748b', lineHeight: 1.45 }}>{help}</small>
      {message && <small style={{ color: message.includes('Render') ? '#b45309' : '#047857', lineHeight: 1.45 }}>{message}</small>}
      {error && <small style={{ color: '#dc2626', lineHeight: 1.45 }}>{error}</small>}

      {!!images.length && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(92px,1fr))', gap: 9 }}>
          {images.map((image, index) => (
            <div key={`${image}-${index}`} style={{ position: 'relative', minWidth: 0 }}>
              <img
                src={image}
                alt=""
                loading="lazy"
                style={{ width: '100%', height: 92, objectFit: 'cover', borderRadius: 12, border: '1px solid #e2e8f0', background: '#f8fafc', display: 'block' }}
              />
              <button
                type="button"
                onClick={() => removeAt(index)}
                aria-label="Xóa ảnh"
                style={{ position: 'absolute', top: 5, right: 5, width: 27, height: 27, borderRadius: '50%', border: 0, background: 'rgba(15,23,42,.82)', color: '#fff', cursor: 'pointer', fontWeight: 800 }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImageUploadField;
