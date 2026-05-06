// components/Map.tsx
import { MapContainer, TileLayer, Marker, Polyline, Popup, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L, { LatLngExpression } from 'leaflet'; // 🌟 LatLngExpression を追加

type Point = { lat: number; lng: number; instruction: string; direction: string };
type MapProps = {
  points: Point[];
  onMapClick: (lat: number, lng: number) => void;
};

// 🌟 型エラー回避：初期位置を LatLngExpression 型として定義
const initialCenter: LatLngExpression = [35.6812, 139.7671];

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

  return L.divIcon({
    html: htmlContent,
    className: '',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function Map({ points, onMapClick }: MapProps) {
  // 🌟 ポリライン用の座標配列も LatLngExpression[] 型にする
  const polylinePositions: LatLngExpression[] = points.map(p => [p.lat, p.lng]);

  return (
    <MapContainer 
      center={initialCenter} // 🌟 修正した変数を渡す
      zoom={15} 
      style={{ height: '500px', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapClickHandler onMapClick={onMapClick} />
      
      {points.map((p, index) => (
        <Marker 
          key={index} 
          position={[p.lat, p.lng] as LatLngExpression} // 🌟 ここも型を明示
          icon={createCustomIcon(p.direction, index)}
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
      
      <Polyline positions={polylinePositions} color="blue" weight={4} opacity={0.7} />
    </MapContainer>
  );
}
