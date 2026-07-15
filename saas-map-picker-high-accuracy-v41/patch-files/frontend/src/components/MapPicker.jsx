import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER = [21.028511, 105.804817];
const GOOD_ACCURACY_METERS = 60;
const MAX_ACCEPTED_ACCURACY_METERS = 500;
const GPS_WAIT_MS = 18000;

const markerIcon = L.divIcon({
  className: 'foodhub-map-marker-wrap',
  html: '<span class="foodhub-map-marker">●</span>',
  iconSize: [34, 34],
  iconAnchor: [17, 30],
});

const roundCoordinate = (value) => Number(Number(value).toFixed(6));
const formatAccuracy = (value) => {
  const accuracy = Number(value);
  if (!Number.isFinite(accuracy)) return '';
  if (accuracy >= 1000) return `${(accuracy / 1000).toFixed(1)} km`;
  return `${Math.round(accuracy)} m`;
};

const getGeoErrorMessage = (error) => {
  if (!error) return 'Không lấy được vị trí hiện tại.';
  if (error.code === error.PERMISSION_DENIED) {
    return 'M chưa cấp quyền vị trí. Hãy cho phép vị trí chính xác trong cài đặt trình duyệt.';
  }
  if (error.code === error.POSITION_UNAVAILABLE) {
    return 'Thiết bị chưa xác định được vị trí. Hãy bật GPS và thử ở nơi thoáng hơn.';
  }
  if (error.code === error.TIMEOUT) {
    return 'GPS phản hồi quá chậm. Hãy bật vị trí chính xác rồi thử lại.';
  }
  return error.message || 'Không lấy được vị trí hiện tại.';
};

const MapPicker = ({
  latitude,
  longitude,
  onChange,
  height = 280,
  title = 'Chọn vị trí trên bản đồ',
  helper = '',
}) => {
  const mapNode = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const watchIdRef = useRef(null);
  const gpsTimerRef = useRef(null);
  const bestPositionRef = useRef(null);
  const finishedRef = useRef(false);

  const [locating, setLocating] = useState(false);
  const [locationMessage, setLocationMessage] = useState('');
  const [locationError, setLocationError] = useState('');
  const [accuracy, setAccuracy] = useState(null);

  const lat = Number(latitude);
  const lng = Number(longitude);
  const hasPoint = latitude !== ''
    && latitude !== null
    && latitude !== undefined
    && longitude !== ''
    && longitude !== null
    && longitude !== undefined
    && Number.isFinite(lat)
    && Number.isFinite(lng);

  const stopGps = () => {
    if (watchIdRef.current !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    if (gpsTimerRef.current) {
      window.clearTimeout(gpsTimerRef.current);
      gpsTimerRef.current = null;
    }
  };

  const showPoint = (point, zoom = 17) => {
    const map = mapRef.current;
    if (!map) return;

    if (markerRef.current) {
      markerRef.current.setLatLng(point);
    } else {
      markerRef.current = L.marker(point, { icon: markerIcon }).addTo(map);
    }

    map.setView(point, zoom, { animate: true });
  };

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return undefined;

    const map = L.map(mapNode.current, {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
    }).setView(hasPoint ? [lat, lng] : DEFAULT_CENTER, hasPoint ? 16 : 12);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 20,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;

    if (hasPoint) {
      markerRef.current = L.marker([lat, lng], { icon: markerIcon }).addTo(map);
    }

    map.on('click', (event) => {
      const point = event.latlng;
      showPoint([point.lat, point.lng], Math.max(map.getZoom(), 17));
      setAccuracy(null);
      setLocationError('');
      setLocationMessage('Đã chọn vị trí thủ công trên bản đồ.');
      onChange?.({
        latitude: roundCoordinate(point.lat),
        longitude: roundCoordinate(point.lng),
        accuracy: null,
        source: 'map',
      });
    });

    window.setTimeout(() => map.invalidateSize(), 0);

    return () => {
      stopGps();
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // Chỉ khởi tạo Leaflet một lần. Giá trị tọa độ được đồng bộ ở effect bên dưới.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current || !hasPoint) return;
    showPoint([lat, lng], Math.max(mapRef.current.getZoom(), 16));
  }, [hasPoint, lat, lng]);

  const finishGps = ({ forced = false } = {}) => {
    if (finishedRef.current) return;

    const position = bestPositionRef.current;
    if (!position) {
      if (forced) {
        finishedRef.current = true;
        stopGps();
        setLocating(false);
        setLocationError('Chưa nhận được tín hiệu GPS. Hãy bật vị trí chính xác rồi thử lại.');
      }
      return;
    }

    const currentAccuracy = Number(position.coords.accuracy);

    if (!forced && currentAccuracy > GOOD_ACCURACY_METERS) return;

    finishedRef.current = true;
    stopGps();
    setLocating(false);
    setAccuracy(currentAccuracy);

    if (!Number.isFinite(currentAccuracy) || currentAccuracy > MAX_ACCEPTED_ACCURACY_METERS) {
      setLocationMessage('');
      setLocationError(
        `Vị trí trình duyệt trả về đang lệch khoảng ${formatAccuracy(currentAccuracy) || 'rất xa'}. `
        + 'Hệ thống chưa tự lưu điểm này. Hãy bật “Vị trí chính xác”, tắt VPN hoặc chạm đúng cửa hàng trên bản đồ.'
      );
      return;
    }

    const point = {
      latitude: roundCoordinate(position.coords.latitude),
      longitude: roundCoordinate(position.coords.longitude),
      accuracy: Math.round(currentAccuracy),
      source: 'gps',
    };

    showPoint(
      [point.latitude, point.longitude],
      currentAccuracy <= GOOD_ACCURACY_METERS ? 18 : 17
    );

    onChange?.(point);
    setLocationError('');
    setLocationMessage(
      currentAccuracy <= GOOD_ACCURACY_METERS
        ? `Đã lấy GPS chính xác, sai số khoảng ${formatAccuracy(currentAccuracy)}.`
        : `Đã lấy vị trí tốt nhất, sai số khoảng ${formatAccuracy(currentAccuracy)}. Có thể chạm bản đồ để chỉnh lại.`
    );
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationError('Trình duyệt hoặc thiết bị này không hỗ trợ định vị.');
      return;
    }

    stopGps();
    bestPositionRef.current = null;
    finishedRef.current = false;
    setLocating(true);
    setAccuracy(null);
    setLocationError('');
    setLocationMessage('Đang chờ GPS ổn định, có thể mất 5–18 giây…');

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const nextAccuracy = Number(position.coords.accuracy);
        const bestAccuracy = Number(bestPositionRef.current?.coords?.accuracy);

        if (
          !bestPositionRef.current
          || !Number.isFinite(bestAccuracy)
          || (Number.isFinite(nextAccuracy) && nextAccuracy < bestAccuracy)
        ) {
          bestPositionRef.current = position;
          setAccuracy(nextAccuracy);
          setLocationMessage(`Đang tối ưu GPS… sai số hiện tại ${formatAccuracy(nextAccuracy)}.`);
        }

        finishGps();
      },
      (error) => {
        if (bestPositionRef.current) {
          finishGps({ forced: true });
          return;
        }

        finishedRef.current = true;
        stopGps();
        setLocating(false);
        setLocationMessage('');
        setLocationError(getGeoErrorMessage(error));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: GPS_WAIT_MS,
      }
    );

    gpsTimerRef.current = window.setTimeout(
      () => finishGps({ forced: true }),
      GPS_WAIT_MS
    );
  };

  useEffect(() => () => stopGps(), []);

  return (
    <div className="map-picker foodhub-map-picker">
      <style>{`
        .foodhub-map-picker{display:block;width:100%}
        .foodhub-map-picker .map-picker-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;margin-bottom:10px}
        .foodhub-map-picker .map-picker-head h4{margin:0 0 4px;color:#0f172a;font-size:15px;font-weight:900}
        .foodhub-map-picker .map-picker-head p{margin:0;color:#64748b;font-size:12px;line-height:1.5}
        .foodhub-map-picker .map-current-button{flex:0 0 auto;min-height:40px;padding:9px 13px;border:1px solid #d7e0dc;border-radius:12px;background:#fff;color:#174b3b;font-weight:900;cursor:pointer;box-shadow:0 5px 16px rgba(15,23,42,.06)}
        .foodhub-map-picker .map-current-button:hover:not(:disabled){border-color:#174b3b;background:#f2faf6}
        .foodhub-map-picker .map-current-button:disabled{cursor:wait;opacity:.7}
        .foodhub-map-picker .map-picker-canvas{width:100%;overflow:hidden;border:1px solid #dfe7e3;border-radius:16px;background:#edf3f0;box-shadow:0 8px 24px rgba(15,23,42,.06)}
        .foodhub-map-picker .map-location-state{display:flex;align-items:center;gap:8px;min-height:22px;margin:9px 2px 0;font-size:12px;font-weight:750;line-height:1.45}
        .foodhub-map-picker .map-location-state.ok{color:#14734f}
        .foodhub-map-picker .map-location-state.error{color:#b42318}
        .foodhub-map-picker .map-location-state.loading{color:#8a6619}
        .foodhub-map-picker .map-coordinates{display:flex;flex-wrap:wrap;gap:8px 14px;margin-top:8px;color:#64748b;font-size:11px}
        .foodhub-map-picker .map-coordinates b{color:#0f172a}
        .foodhub-map-marker-wrap{background:transparent;border:0}
        .foodhub-map-marker{display:flex;align-items:center;justify-content:center;width:30px;height:30px;border:4px solid #fff;border-radius:50% 50% 50% 8px;background:#ee4d2d;color:#fff;font-size:0;box-shadow:0 6px 18px rgba(15,23,42,.35);transform:rotate(-45deg)}
        .foodhub-map-marker::after{content:'';width:8px;height:8px;border-radius:50%;background:#fff}
        @media(max-width:640px){
          .foodhub-map-picker .map-picker-head{display:grid;grid-template-columns:1fr}
          .foodhub-map-picker .map-current-button{width:100%}
        }
      `}</style>

      <div className="map-picker-head">
        <div>
          <h4>{title}</h4>
          {helper && <p>{helper}</p>}
        </div>
        <button
          type="button"
          className="map-current-button"
          onClick={useCurrentLocation}
          disabled={locating}
        >
          {locating ? '⌖ Đang lấy GPS…' : '⌖ Dùng vị trí hiện tại'}
        </button>
      </div>

      <div
        ref={mapNode}
        className="map-picker-canvas"
        style={{ height: Number(height) || 280 }}
      />

      {locationError && (
        <div className="map-location-state error">⚠ {locationError}</div>
      )}
      {!locationError && locationMessage && (
        <div className={`map-location-state ${locating ? 'loading' : 'ok'}`}>
          {locating ? '⌛' : '✓'} {locationMessage}
        </div>
      )}

      <div className="map-coordinates">
        <span>Vĩ độ: <b>{hasPoint ? lat : '—'}</b></span>
        <span>Kinh độ: <b>{hasPoint ? lng : '—'}</b></span>
        {Number.isFinite(Number(accuracy)) && (
          <span>Sai số GPS: <b>{formatAccuracy(accuracy)}</b></span>
        )}
      </div>
    </div>
  );
};

export default MapPicker;
