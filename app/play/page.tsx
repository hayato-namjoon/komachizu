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
    const [currentIndex, setCurrentIndex] = useState(0); // 現在のGPS目標（シングルビュー用）
    const [currentLoc, setCurrentLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [isGpsActive, setIsGpsActive] = useState(false);
    const [distanceToTarget, setDistanceToTarget] = useState<number | null>(null);

    // 🌟 追加：プレイヤーが通過したポイントを記録する配列（インデックスを保持）
    const [checkedPoints, setCheckedPoints] = useState<number[]>([]);

    const [viewMode, setViewMode] = useState<'single' | 'list'>('list');

    useEffect(() => {
        const fetchCourses = async () => {
            const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
            if (data) setCourses(data);
        };
        fetchCourses();
    }, []);

    const toggleGps = () => {
        if (isGpsActive) { setIsGpsActive(false); setCurrentLoc(null); setDistanceToTarget(null); return; }
        if (!navigator.geolocation) return alert('お使いの端末はGPSに対応していません。');

        setIsGpsActive(true);
        navigator.geolocation.watchPosition(
            (pos) => setCurrentLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => { alert('位置情報を取得できませんでした。'); setIsGpsActive(false); },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    };

    useEffect(() => {
        if (currentLoc && selectedCourse) {
            const target = selectedCourse.points[currentIndex];
            setDistanceToTarget(getDistance(currentLoc.lat, currentLoc.lng, target.lat, target.lng));
        }
    }, [currentLoc, currentIndex, selectedCourse]);

    if (!selectedCourse) {
        return (
            <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: '"Zen Kurenaido", sans-serif', backgroundColor: '#fdf6e3', minHeight: '100vh', color: '#5c3a21' }}>
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Zen+Kurenaido&display=swap');`}</style>
                <h1 style={{ textAlign: 'center', borderBottom: '2px dashed #8b5a2b', paddingBottom: '10px' }}>🧭 冒険のコースを選ぶ</h1>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
                    {courses.map(course => (
                        <button key={course.id} onClick={() => { setSelectedCourse(course); setCurrentIndex(0); setCheckedPoints([]); setIsGpsActive(false); setViewMode('list'); }} style={{ padding: '20px', fontSize: '20px', fontWeight: 'bold', backgroundColor: '#fbf4e6', border: '2px solid #8b5a2b', borderRadius: '4px', color: '#5c3a21', cursor: 'pointer', boxShadow: '2px 2px 0px #8b5a2b', fontFamily: 'inherit' }}>
                            🚩 {course.title} <br />
                            <span style={{ fontSize: '14px', fontWeight: 'normal' }}>(全 {course.points.length} ポイント)</span>
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

    const nextPoint = () => { if (!isLast) setCurrentIndex(currentIndex + 1); };
    const prevPoint = () => { if (!isFirst) setCurrentIndex(currentIndex - 1); };

    // 🌟 追加：チェックをつける/外す処理
    const toggleCheck = (index: number) => {
        if (checkedPoints.includes(index)) {
            setCheckedPoints(checkedPoints.filter(i => i !== index));
        } else {
            setCheckedPoints([...checkedPoints, index]);
        }
    };

    const getStampColor = (type: string) => {
        if (type === 'スタート地点') return '#0050b3';
        if (type === 'チェックポイント') return '#d46b08';
        if (type === 'ゴール') return '#cf1322';
        return '#595959';
    };

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: '"Zen Kurenaido", sans-serif', backgroundColor: '#fdf6e3', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#5c3a21' }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Zen+Kurenaido&display=swap');`}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <button onClick={() => setSelectedCourse(null)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #8b5a2b', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}>
                    ↩️ 閉じる
                </button>
                <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
                    達成度: {checkedPoints.length} / {selectedCourse.points.length}
                </div>
            </div>

            <h2 style={{ textAlign: 'center', marginTop: 0, borderBottom: '2px dashed #8b5a2b', paddingBottom: '10px' }}>{selectedCourse.title}</h2>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button onClick={() => setViewMode('list')} style={{ flex: 1, padding: '10px', borderRadius: '4px', fontWeight: 'bold', border: '2px solid #8b5a2b', background: viewMode === 'list' ? '#8b5a2b' : '#fbf4e6', color: viewMode === 'list' ? '#fff' : '#8b5a2b', cursor: 'pointer', fontFamily: 'inherit', fontSize: '16px' }}>
                    🗺️ 一覧・チェック
                </button>
                <button onClick={() => setViewMode('single')} style={{ flex: 1, padding: '10px', borderRadius: '4px', fontWeight: 'bold', border: '2px solid #8b5a2b', background: viewMode === 'single' ? '#8b5a2b' : '#fbf4e6', color: viewMode === 'single' ? '#fff' : '#8b5a2b', cursor: 'pointer', fontFamily: 'inherit', fontSize: '16px' }}>
                    📖 1枚ずつ見る
                </button>
            </div>

            {viewMode === 'single' && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fbf4e6', padding: '10px 15px', borderRadius: '4px', border: '1px solid #8b5a2b', marginBottom: '20px' }}>
                    <button onClick={toggleGps} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #5c3a21', backgroundColor: isGpsActive ? '#fdf6e3' : '#eaddc5', color: '#5c3a21', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
                        {isGpsActive ? '🛰️ 測位中' : '📍 GPS連動'}
                    </button>
                    <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
                        目標: Pt.{currentIndex + 1} ({distanceToTarget !== null ? `${distanceToTarget} m` : '---'})
                    </div>
                </div>
            )}

            {viewMode === 'single' ? (
                // シングルビュー
                <>
                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: '#fbf4e6', borderRadius: '4px', padding: '30px 20px', margin: '10px 0 20px 0', border: '2px solid #8b5a2b', position: 'relative', boxShadow: '2px 2px 8px rgba(0,0,0,0.1)' }}>

                        <div style={{ position: 'absolute', top: '10px', left: '10px', border: `3px solid ${getStampColor(pType)}`, color: getStampColor(pType), padding: '4px 10px', fontWeight: 'bold', fontSize: '16px', transform: 'rotate(-5deg)', opacity: 0.8, borderRadius: '4px', fontFamily: 'sans-serif' }}>
                            {pType === 'スタート地点' ? 'START' : pType === 'チェックポイント' ? 'CHECK POINT' : pType === 'ゴール' ? 'GOAL' : 'ROUTE'}
                        </div>

                        {pType === 'ゴール' ? (
                            <div style={{ fontSize: '120px', lineHeight: '1', marginBottom: '20px', marginTop: '30px' }}>🏆</div>
                        ) : currentPoint.svgCode ? (
                            <div style={{ width: '100%', maxWidth: '250px', display: 'flex', justifyContent: 'center', marginBottom: '20px', marginTop: '30px' }} dangerouslySetInnerHTML={{ __html: currentPoint.svgCode }} />
                        ) : (
                            <div style={{ fontSize: '100px', lineHeight: '1', marginBottom: '20px', marginTop: '30px' }}>{currentPoint.direction === '📍 指定なし' ? '📍' : emoji}</div>
                        )}

                        <div style={{ fontSize: '28px', fontWeight: 'bold', textAlign: 'center' }}>
                            {currentPoint.instruction || ''} {/* 🌟 変更：「道なりに進む」を削除 */}
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', marginTop: 'auto' }}>
                        <button onClick={prevPoint} disabled={isFirst} style={{ flex: 1, padding: '15px', fontSize: '18px', borderRadius: '4px', border: '2px solid #8b5a2b', backgroundColor: isFirst ? '#eaddc5' : '#fbf4e6', color: isFirst ? '#999' : '#5c3a21', cursor: isFirst ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}>◀ 前へ</button>
                        {isLast ? (
                            <button onClick={() => alert('🎉 ゴール！')} style={{ flex: 1, padding: '15px', fontSize: '20px', fontWeight: 'bold', borderRadius: '4px', border: '2px solid #cf1322', backgroundColor: '#cf1322', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>🏁 クリア！</button>
                        ) : (
                            <button onClick={nextPoint} style={{ flex: 2, padding: '15px', fontSize: '20px', fontWeight: 'bold', borderRadius: '4px', border: '2px solid #8b5a2b', backgroundColor: '#8b5a2b', color: 'white', cursor: 'pointer', fontFamily: 'inherit' }}>次へ進む ▶</button>
                        )}
                    </div>
                </>
            ) : (
                // 🌟 リストビュー（チェック機能付き）
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px', paddingBottom: '20px' }}>
                    {selectedCourse.points.map((p, i) => {
                        const ptType = p.pointType || 'ただの道順';
                        const isChecked = checkedPoints.includes(i);

                        return (
                            <div
                                key={i}
                                // 🌟 変更：クリックで拡大表示を削除し、チェックボックスのON/OFF処理に変更
                                onClick={() => toggleCheck(i)}
                                style={{
                                    backgroundColor: isChecked ? '#eaddc5' : '#fbf4e6', // チェック済みなら背景色を暗く
                                    border: '2px solid #8b5a2b',
                                    borderRadius: '4px',
                                    padding: '10px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    boxShadow: isChecked ? 'inset 2px 2px 5px rgba(0,0,0,0.2)' : '2px 2px 4px rgba(0,0,0,0.1)', // 凹んだような影
                                    position: 'relative',
                                    opacity: isChecked ? 0.7 : 1 // チェック済みなら少し薄く
                                }}
                            >
                                {/* 🌟 追加：チェックマーク */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px', borderBottom: '1px solid #eaddc5', paddingBottom: '4px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Pt. {i + 1}</div>
                                    <div style={{ fontSize: '16px', color: isChecked ? '#cf1322' : '#ccc' }}>
                                        {isChecked ? '☑️' : '⬜️'}
                                    </div>
                                </div>

                                {ptType !== 'ただの道順' && (
                                    <div style={{ position: 'absolute', top: '25px', right: '5px', border: `2px solid ${getStampColor(ptType)}`, color: getStampColor(ptType), padding: '2px 4px', fontSize: '10px', fontWeight: 'bold', transform: 'rotate(10deg)', opacity: 0.8, borderRadius: '2px', fontFamily: 'sans-serif' }}>
                                        {ptType === 'スタート地点' ? 'START' : ptType === 'チェックポイント' ? 'CHK' : 'GOAL'}
                                    </div>
                                )}

                                {ptType === 'ゴール' ? (
                                    <div style={{ fontSize: '40px', height: '80px', display: 'flex', alignItems: 'center' }}>🏆</div>
                                ) : p.svgCode ? (
                                    <div style={{ width: '100%', height: '80px', display: 'flex', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: p.svgCode }} />
                                ) : (
                                    <div style={{ fontSize: '40px', height: '80px', display: 'flex', alignItems: 'center' }}>{p.direction.split(' ')[0]}</div>
                                )}
                                <div style={{ fontSize: '16px', marginTop: '8px', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', width: '100%', fontWeight: 'bold' }}>
                                    {p.instruction || ''} {/* 🌟 変更：「道なり」を削除 */}
                                </div>

                                {/* 🌟 追加：チェック済みの時の斜線（バツ印）演出 */}
                                {isChecked && (
                                    <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: '4px', backgroundColor: '#cf1322', transform: 'rotate(-20deg)', opacity: 0.5, borderRadius: '2px', pointerEvents: 'none' }} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}