// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
// components/Map.tsx
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents, useMap } from 'react-leaflet';
import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

type Point = { lat: number; lng: number; instruction: string; direction: string };
type MapProps = {
  points: Point[];
  onMapClick: (lat: number, lng: number) => void;
  center: [number, number];
  // 🌟 追加：ドラッグ終了時の座標を親に伝える関数
  onMarkerDragEnd?: (index: number, lat: number, lng: number) => void;
};

const createCustomIcon = (direction: string, index: number) => {
  const emoji = direction.split(' ')[0];
  const isDefault = direction === '📍 指定なし';

  const htmlContent = `
    <div style="
      background-color: white;
      border: 2px solid ${isDefault ? '#3388ff' : '#ff4500'};
      border-radius: 50%;
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      box-shadow: 0 2px 5px rgba(0,0,0,0.3);
      font-weight: bold;
      color: #333;
    ">
      ${isDefault ? index + 1 : emoji}
    </div>
  `;

  return L.divIcon({ html: htmlContent, className: '', iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });
};

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, 15, { animate: true, duration: 1.5 });
  }, [center, map]);
  return null;
}

// 🌟 props に onMarkerDragEnd を追加
export default function Map({ points, onMapClick, center, onMarkerDragEnd }: MapProps) {
  const MapComp = MapContainer as any;

  return (
    <MapComp center={center} zoom={15} style={{ height: '500px', width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapUpdater center={center} />
      <MapClickHandler onMapClick={onMapClick} />

      {points.map((p, index) => (
        <Marker
          key={index}
          position={[p.lat, p.lng] as any}
          icon={createCustomIcon(p.direction, index)}
          // 🌟 追加：ピンをドラッグ可能にする
          draggable={true}
          // 🌟 追加：ドラッグ終了時に新しい座標を取得して親へ渡す
          eventHandlers={{
            dragend: (e) => {
              const marker = e.target;
              const position = marker.getLatLng();
              if (onMarkerDragEnd) {
                onMarkerDragEnd(index, position.lat, position.lng);
              }
            }
          }}
        >
          <Popup>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>ポイント {index + 1}</div>
            <div style={{ fontSize: '14px' }}>
              <span style={{ fontSize: '18px', marginRight: '4px' }}>{p.direction.split(' ')[0]}</span>
              {p.instruction || <span style={{ color: '#999' }}>指示なし</span>}
            </div>
          </Popup>
        </Marker>
      ))}

      <Polyline positions={points.map(p => [p.lat, p.lng]) as any} color="blue" weight={4} opacity={0.7} />
    </MapComp>
  );
}