import { useEffect, useRef, useState } from 'react';

const DEFAULT_CENTER = [21.0285, 105.8542];

const MapPicker = ({ latitude, longitude, onChange, height = 280, title = 'Chọn vị trí trên bản đồ', helper = '' }) => {
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [locating, setLocating] = useState(false);
  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasPoint = latitude !== '' && latitude !== null && latitude !== undefined && longitude !== '' && longitude !== null && longitude !== undefined && Number.isFinite(lat) && Number.isFinite(lng);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return undefined;
    let cancelled = false;
    let cleanup = () => {};
    const initialize = () => {
      const L = window.L;
      if (!L || cancelled || !mapNode.current || mapRef.current) return false;
      const map = L.map(mapNode.current, { zoomControl: true, scrollWheelZoom: false }).setView(hasPoint ? [lat, lng] : DEFAULT_CENTER, hasPoint ? 16 : 12);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);
    const markerIcon = L.divIcon({ className: 'foodhub-map-marker', html: '<span>●</span>', iconSize: [30, 30], iconAnchor: [15, 15] });
    if (hasPoint) markerRef.current = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
    map.on('click', (event) => {
      const point = event.latlng;
      if (markerRef.current) markerRef.current.setLatLng(point);
      else markerRef.current = L.marker(point, { icon: markerIcon }).addTo(map);
      onChange?.({ latitude: Number(point.lat.toFixed(6)), longitude: Number(point.lng.toFixed(6)) });
    });
      mapRef.current = map;
      window.setTimeout(() => map.invalidateSize(), 120);
      cleanup = () => { map.remove(); mapRef.current = null; markerRef.current = null; };
      return true;
    };
    if (!initialize()) {
      const timer = window.setInterval(() => { if (initialize()) window.clearInterval(timer); }, 150);
      cleanup = () => window.clearInterval(timer);
    }
    return () => { cancelled = true; cleanup(); };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !hasPoint) return;
    const point = [lat, lng];
    if (markerRef.current) markerRef.current.setLatLng(point);
    else { const L = window.L; if (!L) return; markerRef.current = L.marker(point, { icon: L.divIcon({ className: 'foodhub-map-marker', html: '<span>●</span>', iconSize: [30, 30], iconAnchor: [15, 15] }) }).addTo(mapRef.current); }
    mapRef.current.setView(point, Math.max(mapRef.current.getZoom(), 15));
  }, [lat, lng]);

  const useCurrentLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition((position) => {
      const point = { latitude: Number(position.coords.latitude.toFixed(6)), longitude: Number(position.coords.longitude.toFixed(6)) };
      onChange?.(point);
      setLocating(false);
    }, () => setLocating(false), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  };

  return (
    <section className="map-picker-card">
      <div className="map-picker-head">
        <div><b>{title}</b>{helper && <small>{helper}</small>}</div>
        <button type="button" onClick={useCurrentLocation} disabled={locating}>{locating ? 'Đang lấy vị trí...' : '⌖ Dùng vị trí hiện tại'}</button>
      </div>
      <div ref={mapNode} className="map-picker-canvas" style={{ height }} />
      <div className="map-coordinates"><span>Vĩ độ: <b>{hasPoint ? lat : '—'}</b></span><span>Kinh độ: <b>{hasPoint ? lng : '—'}</b></span></div>
    </section>
  );
};

export default MapPicker;
