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
    const [currentLoc, setCurrentLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [isGpsActive, setIsGpsActive] = useState(false);

    const [checkedPoints, setCheckedPoints] = useState<number[]>([]);
    const [discoveredCheckpoints, setDiscoveredCheckpoints] = useState<number[]>([]); // 🌟 到達したチェックポイントのインデックス
    const [currentTab, setCurrentTab] = useState<'map' | 'checkpoint'>('map'); // 🌟 表示するタブ

    useEffect(() => {
        const fetchCourses = async () => {
            const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
            if (data) setCourses(data);
        };
        fetchCourses();
    }, []);

    const toggleGps = () => {
        if (isGpsActive) { setIsGpsActive(false); setCurrentLoc(null); return; }
        if (!navigator.geolocation) return alert('GPS非対応です');

        setIsGpsActive(true);
        navigator.geolocation.watchPosition(
            (pos) => setCurrentLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
            () => { alert('位置情報取得失敗'); setIsGpsActive(false); },
            { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
        );
    };

    // 🌟 GPSでチェックポイントへの到達を判定
    useEffect(() => {
        if (currentLoc && selectedCourse) {
            selectedCourse.points.forEach((p, i) => {
                const dist = getDistance(currentLoc.lat, currentLoc.lng, p.lat, p.lng);
                const threshold = p.radius || 5;

                if (p.pointType === 'チェックポイント' && dist <= threshold && !discoveredCheckpoints.includes(i)) {
                    setDiscoveredCheckpoints(prev => [...prev, i].sort((a, b) => a - b));
                    alert(`✨ チェックポイント到達！\n「チェックポイントページ」に新たな指示が追加されました。`);
                }
            });
        }
    }, [currentLoc, selectedCourse, discoveredCheckpoints]);

    if (!selectedCourse) {
        return (
            <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: '"Zen Kurenaido", sans-serif', backgroundColor: '#fdf6e3', minHeight: '100vh', color: '#5c3a21' }}>
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Zen+Kurenaido&display=swap');`}</style>
                <h1 style={{ textAlign: 'center', borderBottom: '2px dashed #8b5a2b', paddingBottom: '10px' }}>🧭 冒険のコースを選ぶ</h1>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
                    {courses.map(course => (
                        <button key={course.id} onClick={() => { setSelectedCourse(course); setCheckedPoints([]); setDiscoveredCheckpoints([]); setIsGpsActive(false); setCurrentTab('map'); }} style={{ padding: '20px', fontSize: '20px', fontWeight: 'bold', backgroundColor: '#fbf4e6', border: '2px solid #8b5a2b', borderRadius: '4px', color: '#5c3a21', cursor: 'pointer', boxShadow: '2px 2px 0px #8b5a2b', fontFamily: 'inherit' }}>
                            🚩 {course.title}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    const toggleCheck = (actualIndex: number) => {
        if (checkedPoints.includes(actualIndex)) {
            setCheckedPoints(checkedPoints.filter(i => i !== actualIndex));
        } else {
            setCheckedPoints([...checkedPoints, actualIndex]);
        }
    };

    const getStampColor = (type?: string) => {
        if (type === 'スタート地点') return '#0050b3';
        if (type === 'チェックポイント') return '#d46b08';
        if (type === 'ゴール') return '#cf1322';
        return 'transparent'; // ただの道順は枠線を消す
    };

    // ルート（地図）用のポイント（スタート、ただの道順、ゴール）
    const mapPoints = selectedCourse.points.map((p, i) => ({ point: p, index: i }))
        .filter(item => item.point.pointType !== 'チェックポイント');

    // 到達したチェックポイント用のデータ
    const cpPoints = discoveredCheckpoints.map(i => ({ point: selectedCourse.points[i], index: i }));

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

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fbf4e6', padding: '10px 15px', borderRadius: '4px', border: '1px solid #8b5a2b', marginBottom: '15px' }}>
                <button onClick={toggleGps} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #5c3a21', backgroundColor: isGpsActive ? '#fdf6e3' : '#eaddc5', color: '#5c3a21', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {isGpsActive ? '🛰️ 測位中...' : '📍 GPS連動'}
                </button>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#666' }}>
                    {isGpsActive ? '隠しポイントを探索中' : 'GPSをオンにして探索しよう'}
                </div>
            </div>

            {/* 🌟 追加：タブ切り替え */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                    onClick={() => setCurrentTab('map')}
                    style={{ flex: 1, padding: '10px', borderRadius: '4px', fontWeight: 'bold', border: '2px solid #8b5a2b', background: currentTab === 'map' ? '#8b5a2b' : '#fbf4e6', color: currentTab === 'map' ? '#fff' : '#8b5a2b', cursor: 'pointer', fontFamily: 'inherit', fontSize: '16px' }}
                >
                    🗺️ ルート地図
                </button>
                <button
                    onClick={() => setCurrentTab('checkpoint')}
                    style={{ flex: 1, padding: '10px', borderRadius: '4px', fontWeight: 'bold', border: '2px solid #d46b08', background: currentTab === 'checkpoint' ? '#d46b08' : '#fffbe6', color: currentTab === 'checkpoint' ? '#fff' : '#d46b08', cursor: 'pointer', fontFamily: 'inherit', fontSize: '16px', position: 'relative' }}
                >
                    🚩 隠しポイント
                    {/* 到達したチェックポイントがあればバッジを表示 */}
                    {discoveredCheckpoints.length > 0 && (
                        <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#cf1322', color: '#fff', borderRadius: '50%', padding: '2px 6px', fontSize: '12px' }}>
                            {discoveredCheckpoints.length}
                        </span>
                    )}
                </button>
            </div>

            {/* 🌟 ルート地図タブの表示 */}
            {currentTab === 'map' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px', paddingBottom: '20px' }}>
                    {mapPoints.map(({ point: p, index: i }) => {
                        const isChecked = checkedPoints.includes(i);
                        const ptType = p.pointType || 'ただの道順'; // 修正：デフォルト値の設定
                        const isGoalOrStart = ptType === 'スタート地点' || ptType === 'ゴール';

                        return (
                            <div key={i} onClick={() => toggleCheck(i)} style={{ backgroundColor: isChecked ? '#eaddc5' : '#fbf4e6', border: '2px solid #8b5a2b', borderRadius: '4px', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: isChecked ? 'inset 2px 2px 5px rgba(0,0,0,0.2)' : '2px 2px 4px rgba(0,0,0,0.1)', position: 'relative', opacity: isChecked ? 0.7 : 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px', borderBottom: '1px solid #eaddc5', paddingBottom: '4px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Pt.{i + 1}</div>
                                    <div style={{ fontSize: '16px', color: isChecked ? '#cf1322' : '#ccc' }}>{isChecked ? '☑️' : '⬜️'}</div>
                                </div>

                                {/* 🌟 修正：ただの道順の時にはスタンプを表示しない */}
                                {isGoalOrStart && (
                                    <div style={{ position: 'absolute', top: '25px', right: '5px', border: `2px solid ${getStampColor(ptType)}`, color: getStampColor(ptType), padding: '2px 4px', fontSize: '10px', fontWeight: 'bold', transform: 'rotate(10deg)', opacity: 0.8, borderRadius: '2px', fontFamily: 'sans-serif' }}>
                                        {ptType === 'スタート地点' ? 'START' : 'GOAL'}
                                    </div>
                                )}

                                {ptType === 'ゴール' ? (
                                    <div style={{ fontSize: '40px', height: '80px', display: 'flex', alignItems: 'center' }}>🏆</div>
                                ) : p.svgCode ? (
                                    <div style={{ width: '100%', height: '80px', display: 'flex', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: p.svgCode }} />
                                ) : (
                                    <div style={{ fontSize: '40px', height: '80px', display: 'flex', alignItems: 'center' }}>{p.direction.split(' ')[0]}</div>
                                )}

                                <div style={{ fontSize: '16px', marginTop: '8px', textAlign: 'center', fontWeight: 'bold' }}>{p.instruction}</div>

                                {isChecked && (
                                    <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: '4px', backgroundColor: '#cf1322', transform: 'rotate(-20deg)', opacity: 0.5, borderRadius: '2px' }} />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 🌟 チェックポイントタブの表示 */}
            {currentTab === 'checkpoint' && (
                <div>
                    {cpPoints.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#fffbe6', border: '2px dashed #d46b08', borderRadius: '4px', color: '#d46b08', fontWeight: 'bold' }}>
                            <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔍</div>
                            まだ隠しポイントを発見していません。<br />GPSをオンにしてコースを探索しましょう。
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px', paddingBottom: '20px' }}>
                            {cpPoints.map(({ point: p, index: i }) => {
                                const isChecked = checkedPoints.includes(i);

                                return (
                                    <div key={i} onClick={() => toggleCheck(i)} style={{ backgroundColor: isChecked ? '#eaddc5' : '#fffbe6', border: '2px solid #d46b08', borderRadius: '4px', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: isChecked ? 'inset 2px 2px 5px rgba(0,0,0,0.2)' : '2px 2px 4px rgba(0,0,0,0.1)', position: 'relative', opacity: isChecked ? 0.7 : 1 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px', borderBottom: '1px solid #eaddc5', paddingBottom: '4px' }}>
                                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#d46b08' }}>Pt.{i + 1}</div>
                                            <div style={{ fontSize: '16px', color: isChecked ? '#cf1322' : '#ccc' }}>{isChecked ? '☑️' : '⬜️'}</div>
                                        </div>

                                        <div style={{ position: 'absolute', top: '25px', right: '5px', border: `2px solid ${getStampColor('チェックポイント')}`, color: getStampColor('チェックポイント'), padding: '2px 4px', fontSize: '10px', fontWeight: 'bold', transform: 'rotate(10deg)', opacity: 0.8, borderRadius: '2px', fontFamily: 'sans-serif' }}>
                                            CHK
                                        </div>

                                        {p.svgCode ? (
                                            <div style={{ width: '100%', height: '80px', display: 'flex', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: p.svgCode }} />
                                        ) : (
                                            <div style={{ fontSize: '40px', height: '80px', display: 'flex', alignItems: 'center' }}>{p.direction.split(' ')[0]}</div>
                                        )}

                                        <div style={{ fontSize: '16px', marginTop: '8px', textAlign: 'center', fontWeight: 'bold' }}>{p.instruction}</div>

                                        {isChecked && (
                                            <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: '4px', backgroundColor: '#cf1322', transform: 'rotate(-20deg)', opacity: 0.5, borderRadius: '2px' }} />
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}