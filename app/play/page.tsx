// app/play/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

type Point = { lat: number; lng: number; instruction: string; direction: string; svgCode?: string; pointType?: string; radius?: number; };
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

    // 🌟 追加：表示モードと、拡大表示中のポイントID
    const [viewMode, setViewMode] = useState<'single' | 'list'>('single');
    const [zoomedIndex, setZoomedIndex] = useState<number | null>(null);

    useEffect(() => {
        const fetchCourses = async () => {
            const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
            if (data) setCourses(data);
        };
        fetchCourses();
    }, []);

    const toggleGps = () => {
        if (isGpsActive) {
            setIsGpsActive(false); setCurrentLoc(null); setDistanceToTarget(null); return;
        }
        if (!navigator.geolocation) return alert('お使いの端末はGPSに対応していません。');

        setIsGpsActive(true);
        navigator.geolocation.watchPosition(
            (position) => setCurrentLoc({ lat: position.coords.latitude, lng: position.coords.longitude }),
            () => { alert('位置情報を取得できませんでした。'); setIsGpsActive(false); },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    };

    useEffect(() => {
        if (currentLoc && selectedCourse) {
            const target = selectedCourse.points[currentIndex];
            const dist = getDistance(currentLoc.lat, currentLoc.lng, target.lat, target.lng);
            setDistanceToTarget(dist);
            // 🌟 変更：勝手に次へ進む処理（setCurrentIndex(prev + 1)）を削除し、距離の表示のみに留める
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
                            onClick={() => { setSelectedCourse(course); setCurrentIndex(0); setIsGpsActive(false); setViewMode('single'); }}
                            style={{ padding: '20px', fontSize: '18px', fontWeight: 'bold', backgroundColor: '#fff', border: '2px solid #1890ff', borderRadius: '12px', color: '#1890ff', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
                        >
                            🚩 {course.title} <br />
                            <span style={{ fontSize: '14px', color: '#666', fontWeight: 'normal' }}>(全 {course.points.length} ポイント)</span>
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
    const pType = currentPoint.pointType || (isFirst ? 'スタート地点' : isLast ? 'ゴール' : 'ただの道順');

    let themeColor = '#1890ff'; let bgColor = '#e6f7ff'; let borderColor = '#91d5ff';
    if (pType === 'ただの道順') { themeColor = '#595959'; bgColor = '#f5f5f5'; borderColor = '#d9d9d9'; }
    else if (pType === 'チェックポイント') { themeColor = '#faad14'; bgColor = '#fffbe6'; borderColor = '#ffe58f'; }
    else if (pType === 'ゴール') { themeColor = '#f5222d'; bgColor = '#fff1f0'; borderColor = '#ffa39e'; }

    const nextPoint = () => { if (!isLast) setCurrentIndex(currentIndex + 1); };
    const prevPoint = () => { if (!isFirst) setCurrentIndex(currentIndex - 1); };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

            {/* ヘッダー周り */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <button onClick={() => setSelectedCourse(null)} style={{ padding: '8px 12px', background: 'none', border: '1px solid #ccc', borderRadius: '8px', cursor: 'pointer' }}>
                    ↩️ コース選択へ
                </button>
                <div style={{ fontWeight: 'bold', color: '#666' }}>
                    ポイント {currentIndex + 1} / {selectedCourse.points.length}
                </div>
            </div>

            <h2 style={{ textAlign: 'center', marginTop: 0, color: '#333' }}>{selectedCourse.title}</h2>

            {/* 🌟 追加：表示モードの切り替えタブ */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button onClick={() => setViewMode('single')} style={{ flex: 1, padding: '10px', borderRadius: '8px', fontWeight: 'bold', border: '2px solid #1890ff', background: viewMode === 'single' ? '#1890ff' : '#fff', color: viewMode === 'single' ? '#fff' : '#1890ff', cursor: 'pointer' }}>
                    📖 1つずつ見る
                </button>
                <button onClick={() => setViewMode('list')} style={{ flex: 1, padding: '10px', borderRadius: '8px', fontWeight: 'bold', border: '2px solid #1890ff', background: viewMode === 'list' ? '#1890ff' : '#fff', color: viewMode === 'list' ? '#fff' : '#1890ff', cursor: 'pointer' }}>
                    🗺️ 一覧を見る
                </button>
            </div>

            {/* GPS連動ボタン（単一モードの時だけ表示） */}
            {viewMode === 'single' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', padding: '10px 15px', borderRadius: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', marginBottom: '20px' }}>
                    <button onClick={toggleGps} style={{ padding: '8px 16px', borderRadius: '20px', border: 'none', backgroundColor: isGpsActive ? '#52c41a' : '#d9d9d9', color: 'white', fontWeight: 'bold', cursor: 'pointer', transition: 'background 0.3s' }}>
                        {isGpsActive ? '🛰️ GPS連動中' : '📍 GPS連動をON'}
                    </button>
                    <div style={{ fontSize: '18px', fontWeight: 'bold', color: isGpsActive ? '#1890ff' : '#ccc' }}>
                        残り: {distanceToTarget !== null ? `${distanceToTarget} m` : '--- m'}
                    </div>
                </div>
            )}

            {/* 🌟 メインコンテンツエリア */}
            {viewMode === 'single' ? (
                // 単一表示モード
                <>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: bgColor, borderRadius: '20px', padding: '30px 20px', margin: '10px 0 20px 0', boxShadow: '0 8px 16px rgba(0,0,0,0.1)', border: `3px solid ${borderColor}`, position: 'relative' }}>
                        <div style={{ position: 'absolute', top: '-15px', backgroundColor: themeColor, color: 'white', padding: '5px 20px', borderRadius: '20px', fontWeight: 'bold', fontSize: '14px' }}>
                            {pType === 'スタート地点' ? '🏁 スタート' : pType === 'チェックポイント' ? '🚩 チェックポイント' : pType === 'ゴール' ? '🏆 ゴール！' : '🚶 道順'}
                        </div>

                        {pType === 'ゴール' && (!currentPoint.svgCode) ? (
                            <div style={{ fontSize: '120px', lineHeight: '1', marginBottom: '20px' }}>🏆</div>
                        ) : currentPoint.svgCode ? (
                            <div style={{ width: '100%', maxWidth: '250px', display: 'flex', justifyContent: 'center', marginBottom: '20px' }} dangerouslySetInnerHTML={{ __html: currentPoint.svgCode }} />
                        ) : (
                            <div style={{ fontSize: '100px', lineHeight: '1', marginBottom: '20px' }}>{currentPoint.direction === '📍 指定なし' ? '📍' : emoji}</div>
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
                </>
            ) : (
                // 🌟 一覧表示モード (グリッドレイアウト)
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px', paddingBottom: '20px' }}>
                    {selectedCourse.points.map((p, i) => (
                        <div
                            key={i}
                            onClick={() => setZoomedIndex(i)}
                            style={{ backgroundColor: '#fff', border: '2px solid #ddd', borderRadius: '12px', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', transition: 'transform 0.2s' }}
                            onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                            onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
                        >
                            <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '8px', width: '100%', textAlign: 'left' }}>Pt. {i + 1}</div>
                            {p.svgCode ? (
                                <div style={{ width: '100%', height: '80px', display: 'flex', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: p.svgCode }} />
                            ) : (
                                <div style={{ fontSize: '40px', height: '80px', display: 'flex', alignItems: 'center' }}>{p.direction.split(' ')[0]}</div>
                            )}
                            <div style={{ fontSize: '11px', color: '#333', marginTop: '8px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%' }}>
                                {p.instruction || '道なり'}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* 🌟 追加：拡大表示用のモーダル（ポップアップ） */}
            {zoomedIndex !== null && (
                <div
                    style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
                    onClick={() => setZoomedIndex(null)} // 背景クリックで閉じる
                >
                    <div
                        style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '16px', maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}
                        onClick={(e) => e.stopPropagation()} // 中身クリックでは閉じないようにする
                    >
                        <h3 style={{ marginTop: 0, color: '#333' }}>ポイント {zoomedIndex + 1}</h3>
                        {selectedCourse.points[zoomedIndex].svgCode ? (
                            <div style={{ width: '100%', maxWidth: '300px', marginBottom: '20px' }} dangerouslySetInnerHTML={{ __html: selectedCourse.points[zoomedIndex].svgCode! }} />
                        ) : (
                            <div style={{ fontSize: '100px', marginBottom: '20px' }}>{selectedCourse.points[zoomedIndex].direction.split(' ')[0]}</div>
                        )}
                        <p style={{ fontSize: '20px', fontWeight: 'bold', textAlign: 'center', margin: '0 0 20px 0', color: '#333' }}>
                            {selectedCourse.points[zoomedIndex].instruction || '道なりに進む'}
                        </p>
                        <button onClick={() => setZoomedIndex(null)} style={{ width: '100%', padding: '14px', fontSize: '16px', fontWeight: 'bold', background: '#333', color: '#fff', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                            閉じる
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}