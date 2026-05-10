// app/play/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

// 🌟 変更: pointType を型に追加
type Point = {
    lat: number; lng: number; instruction: string; direction: string;
    svgCode?: string; pointType?: string; radius?: number;
};
type Course = { id: string; title: string; points: Point[] };

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.floor(R * c);
}

export default function PlayPage() {
    const [courses, setCourses] = useState<Course[]>([]);
    const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);

    const [currentLoc, setCurrentLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [isGpsActive, setIsGpsActive] = useState(false);
    const [distanceToTarget, setDistanceToTarget] = useState<number | null>(null);

    useEffect(() => {
        if (currentLoc && selectedCourse) {
            const target = selectedCourse.points[currentIndex];
            const dist = getDistance(currentLoc.lat, currentLoc.lng, target.lat, target.lng);
            setDistanceToTarget(dist);

            // 🌟 変更：ハードコーディングされた 20 ではなく、ポイントごとの radius を使用する
            const threshold = target.radius || 20; // 設定がない古いデータは20mとする

            if (dist <= threshold && currentIndex < selectedCourse.points.length - 1) {
                const nextType = selectedCourse.points[currentIndex + 1].pointType;
                const arrivalMsg = nextType === 'ゴール' ? '🏁 ついにゴール地点に到着しました！' :
                    nextType === 'チェックポイント' ? '🚩 チェックポイントに到着しました！' :
                        '📍 ポイントに到着しました！次の指示へ進みます。';

                alert(arrivalMsg);
                setCurrentIndex((prev) => prev + 1);
            }
        }
    }, [currentLoc, currentIndex, selectedCourse]);

    const toggleGps = () => {
        if (isGpsActive) {
            setIsGpsActive(false);
            setCurrentLoc(null);
            setDistanceToTarget(null);
            return;
        }

        if (!navigator.geolocation) {
            alert('お使いの端末やブラウザはGPSに対応していません。');
            return;
        }

        setIsGpsActive(true);
        navigator.geolocation.watchPosition(
            (position) => {
                setCurrentLoc({ lat: position.coords.latitude, lng: position.coords.longitude });
            },
            (error) => {
                console.error("GPSエラー:", error);
                alert('位置情報を取得できませんでした。スマホの設定で許可されているか確認してください。');
                setIsGpsActive(false);
            },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    };

    useEffect(() => {
        if (currentLoc && selectedCourse) {
            const target = selectedCourse.points[currentIndex];
            const dist = getDistance(currentLoc.lat, currentLoc.lng, target.lat, target.lng);
            setDistanceToTarget(dist);

            if (dist < 20 && currentIndex < selectedCourse.points.length - 1) {
                // 🌟 変更：チェックポイントやゴールに着いた時はアラートの文言を少し豪華にする
                const nextType = selectedCourse.points[currentIndex + 1].pointType;
                const arrivalMsg = nextType === 'ゴール' ? '🏁 ついにゴール地点に到着しました！' :
                    nextType === 'チェックポイント' ? '🚩 チェックポイントに到着しました！' :
                        '📍 ポイントに到着しました！次の指示へ進みます。';

                alert(arrivalMsg);
                setCurrentIndex((prev) => prev + 1);
            }
        }
    }, [currentLoc, currentIndex, selectedCourse]);

    if (!selectedCourse) {
        return (
            <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>
                <h1 style={{ textAlign: 'center', color: '#333' }}>🚶‍♂️ コマ地図ウォークラリー</h1>
                <p style={{ textAlign: 'center', color: '#666', marginBottom: '30px' }}>遊ぶコースを選んでください</p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {courses.map(course => (
                        <button
                            key={course.id}
                            onClick={() => {
                                setSelectedCourse(course);
                                setCurrentIndex(0);
                                setIsGpsActive(false);
                            }}
                            style={{ padding: '20px', fontSize: '18px', fontWeight: 'bold', backgroundColor: '#fff', border: '2px solid #1890ff', borderRadius: '12px', color: '#1890ff', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                        >
                            🚩 {course.title} <br />
                            <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>
                                (全 {course.points.length} ポイント)
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    const currentPoint = selectedCourse.points[currentIndex];
    const isFirst = currentIndex === 0;
    const isLast = currentIndex === selectedCourse.points.length - 1;
    const emoji = currentPoint.direction.split(' ')[0];

    // 🌟 状態（pointType）の取得（過去のデータで未設定の場合は自動判定）
    const pType = currentPoint.pointType || (isFirst ? 'スタート地点' : isLast ? 'ゴール' : 'ただの道順');

    // 🌟 状態に応じたカラーテーマの設定
    let themeColor = '#1890ff'; // デフォルト（青）
    let bgColor = '#e6f7ff';
    let borderColor = '#91d5ff';

    if (pType === 'ただの道順') {
        themeColor = '#595959'; // グレー
        bgColor = '#f5f5f5';
        borderColor = '#d9d9d9';
    } else if (pType === 'チェックポイント') {
        themeColor = '#faad14'; // オレンジ
        bgColor = '#fffbe6';
        borderColor = '#ffe58f';
    } else if (pType === 'ゴール') {
        themeColor = '#f5222d'; // 赤
        bgColor = '#fff1f0';
        borderColor = '#ffa39e';
    }

    const nextPoint = () => { if (!isLast) setCurrentIndex(currentIndex + 1); };
    const prevPoint = () => { if (!isFirst) setCurrentIndex(currentIndex - 1); };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <button onClick={() => setSelectedCourse(null)} style={{ padding: '8px 12px', background: 'none', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer' }}>
                    ↩️ コース選択へ
                </button>
                <div style={{ fontWeight: 'bold', color: '#666' }}>
                    ポイント {currentIndex + 1} / {selectedCourse.points.length}
                </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '10px 15px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                <button
                    onClick={toggleGps}
                    style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: isGpsActive ? '#52c41a' : '#d9d9d9', color: 'white', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.3s' }}
                >
                    {isGpsActive ? '🛰️ GPS連動中' : '📍 GPS連動をON'}
                </button>
                <div style={{ fontSize: '18px', fontWeight: 'bold', color: isGpsActive ? '#1890ff' : '#ccc' }}>
                    残り: {distanceToTarget !== null ? `${distanceToTarget} m` : '--- m'}
                </div>
            </div>

            <h2 style={{ textAlign: 'center', marginTop: 0, color: '#333' }}>{selectedCourse.title}</h2>

            {/* 🌟 変更: 状態に応じて背景色と枠線の色が変わる */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: bgColor, borderRadius: '20px', padding: '30px 20px', margin: '10px 0 20px 0', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', border: `3px solid ${borderColor}`, position: 'relative' }}>

                {/* 🌟 追加: 状態を示すバッジ */}
                <div style={{ position: 'absolute', top: '-15px', backgroundColor: themeColor, color: 'white', padding: '5px 20px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }}>
                    {pType === 'スタート地点' ? '🏁 スタート' :
                        pType === 'チェックポイント' ? '🚩 チェックポイント' :
                            pType === 'ゴール' ? '🏆 ゴール！' : '🚶 道順'}
                </div>

                {pType === 'ゴール' && (!currentPoint.svgCode || currentPoint.svgCode.trim() === '') ? (
                    // ゴール地点でSVGがない場合はトロフィーを表示
                    <div style={{ fontSize: '120px', lineHeight: '1', marginBottom: '20px', filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.2))' }}>🏆</div>
                ) : currentPoint.svgCode && currentPoint.svgCode.trim() !== '' ? (
                    // SVGがある場合はSVGを表示
                    <div
                        style={{ width: '100%', maxWidth: '250px', display: 'flex', justifyContent: 'center', marginBottom: '20px' }}
                        dangerouslySetInnerHTML={{ __html: currentPoint.svgCode }}
                    />
                ) : (
                    // それ以外は絵文字
                    <div style={{ fontSize: '100px', lineHeight: '1', marginBottom: '20px', filter: 'drop-shadow(0px 4px 4px rgba(0,0,0,0.2))' }}>
                        {currentPoint.direction === '📍 指定なし' ? '📍' : emoji}
                    </div>
                )}

                <div style={{ fontSize: '24px', fontWeight: 'bold', textAlign: 'center', color: '#333' }}>
                    {currentPoint.instruction || (pType === 'ゴール' ? 'お疲れ様でした！' : '道なりに進む')}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', marginTop: 'auto' }}>
                <button onClick={prevPoint} disabled={isFirst} style={{ flex: 1, padding: '15px', fontSize: '16px', borderRadius: '12px', border: 'none', backgroundColor: isFirst ? '#f0f0f0' : '#e6f7ff', color: isFirst ? '#999' : '#1890ff', cursor: isFirst ? 'not-allowed' : 'pointer' }}>◀ 前へ</button>
                {isLast ? (
                    <button onClick={() => alert('🎉 ゴールおめでとうございます！！')} style={{ flex: 1, padding: '15px', fontSize: '18px', fontWeight: 'bold', borderRadius: '12px', border: 'none', backgroundColor: '#ff4d4f', color: 'white', cursor: 'pointer' }}>🏁 クリア！</button>
                ) : (
                    <button onClick={nextPoint} style={{ flex: 2, padding: '15px', fontSize: '18px', fontWeight: 'bold', borderRadius: '12px', border: 'none', backgroundColor: themeColor, color: 'white', cursor: 'pointer' }}>次へ進む ▶</button>
                )}
            </div>
        </div>
    );
}