// app/play/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { supabase } from '../../utils/supabase';

// app/play/page.tsx の上部の型定義のみ更新
type Point = {
    lat: number; lng: number; instruction: string; direction: string;
    svgCode?: string; pointType?: string; radius?: number;
    landmark?: string; // 🌟 これを追加
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
    const [currentLoc, setCurrentLoc] = useState<{ lat: number; lng: number } | null>(null);
    const [isGpsActive, setIsGpsActive] = useState(false);

    const [checkedPoints, setCheckedPoints] = useState<number[]>([]);
    const [discoveredCheckpoints, setDiscoveredCheckpoints] = useState<number[]>([]);
    const [isGoalReached, setIsGoalReached] = useState(false); // 🌟 ゴール達成フラグ
    const [currentTab, setCurrentTab] = useState<'map' | 'checkpoint'>('map');

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

    // 🌟 GPSで「チェックポイント」と「ゴール」への到達を判定
    useEffect(() => {
        if (currentLoc && selectedCourse) {
            selectedCourse.points.forEach((p, i) => {
                const dist = getDistance(currentLoc.lat, currentLoc.lng, p.lat, p.lng);
                const threshold = p.radius || 5;

                // チェックポイント到達判定
                if (p.pointType === 'チェックポイント' && dist <= threshold && !discoveredCheckpoints.includes(i)) {
                    setDiscoveredCheckpoints(prev => [...prev, i].sort((a, b) => a - b));
                    alert(`✨ チェックポイント到達！\n「${p.instruction}」を発見しました。`);
                }

                // 🌟 ゴール到達判定（一覧には出ていないが裏で判定）
                if (p.pointType === 'ゴール' && dist <= threshold && !isGoalReached) {
                    setIsGoalReached(true);
                    alert(`🎊 🏆 ゴール到達！！ 🏆 🎊\nおめでとうございます！「${selectedCourse.title}」をクリアしました！`);
                }
            });
        }
    }, [currentLoc, selectedCourse, discoveredCheckpoints, isGoalReached]);

    if (!selectedCourse) {
        return (
            <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: '"Zen Kurenaido", sans-serif', backgroundColor: '#fdf6e3', minHeight: '100vh', color: '#5c3a21' }}>
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Zen+Kurenaido&display=swap');`}</style>
                <h1 style={{ textAlign: 'center', borderBottom: '2px dashed #8b5a2b', paddingBottom: '10px' }}>🧭 冒険のコースを選ぶ</h1>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
                    {courses.map(course => (
                        <button key={course.id} onClick={() => { setSelectedCourse(course); setCheckedPoints([]); setDiscoveredCheckpoints([]); setIsGoalReached(false); setIsGpsActive(false); setCurrentTab('map'); }} style={{ padding: '20px', fontSize: '20px', fontWeight: 'bold', backgroundColor: '#fbf4e6', border: '2px solid #8b5a2b', borderRadius: '4px', color: '#5c3a21', cursor: 'pointer', boxShadow: '2px 2px 0px #8b5a2b', fontFamily: 'inherit' }}>
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
        return 'transparent';
    };

    // 🌟 修正：ルート地図用のポイントから「チェックポイント」と「ゴール」の両方を除外
    const mapPoints = selectedCourse.points.map((p, i) => ({ point: p, index: i }))
        .filter(item => item.point.pointType !== 'チェックポイント' && item.point.pointType !== 'ゴール');

    const cpPoints = discoveredCheckpoints.map(i => ({ point: selectedCourse.points[i], index: i }));

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: '"Zen Kurenaido", sans-serif', backgroundColor: isGoalReached ? '#fff1f0' : '#fdf6e3', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#5c3a21', transition: 'background-color 1s' }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Zen+Kurenaido&display=swap');`}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <button onClick={() => setSelectedCourse(null)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #8b5a2b', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}>
                    ↩️ 終了
                </button>
                <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
                    {isGoalReached ? '🏆 CLEAR!' : `進行中: ${checkedPoints.length} / ${mapPoints.length}`}
                </div>
            </div>

            <h2 style={{ textAlign: 'center', marginTop: 0, borderBottom: '2px dashed #8b5a2b', paddingBottom: '10px' }}>
                {isGoalReached ? '🎊 FINISHED 🎊' : selectedCourse.title}
            </h2>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fbf4e6', padding: '10px 15px', borderRadius: '4px', border: '1px solid #8b5a2b', marginBottom: '15px' }}>
                <button onClick={toggleGps} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #5c3a21', backgroundColor: isGpsActive ? '#fdf6e3' : '#eaddc5', color: '#5c3a21', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {isGpsActive ? '🛰️ 測位中...' : '📍 GPS連動'}
                </button>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#666' }}>
                    {isGoalReached ? 'ゴール地点に到着しました！' : '目的地に近づくと変化が起きます'}
                </div>
            </div>

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
                    {discoveredCheckpoints.length > 0 && (
                        <span style={{ position: 'absolute', top: '-8px', right: '-8px', background: '#cf1322', color: '#fff', borderRadius: '50%', padding: '2px 6px', fontSize: '12px' }}>
                            {discoveredCheckpoints.length}
                        </span>
                    )}
                </button>
            </div>

            {/* 🌟 ルート地図タブ */}
            {currentTab === 'map' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px', paddingBottom: '20px' }}>
                    {mapPoints.map(({ point: p, index: i }) => {
                        const isChecked = checkedPoints.includes(i);
                        const ptType = p.pointType || 'ただの道順';
                        const isStart = ptType === 'スタート地点';

                        return (
                            <div key={i} onClick={() => toggleCheck(i)} style={{ backgroundColor: isChecked ? '#eaddc5' : '#fbf4e6', border: '2px solid #8b5a2b', borderRadius: '4px', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: isChecked ? 'inset 2px 2px 5px rgba(0,0,0,0.2)' : '2px 2px 4px rgba(0,0,0,0.1)', position: 'relative', opacity: isChecked ? 0.7 : 1 }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px', borderBottom: '1px solid #eaddc5', paddingBottom: '4px' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 'bold' }}>No.{i + 1}</div>
                                    <div style={{ fontSize: '16px', color: isChecked ? '#cf1322' : '#ccc' }}>{isChecked ? '☑️' : '⬜️'}</div>
                                </div>

                                {isStart && (
                                    <div style={{ position: 'absolute', top: '25px', right: '5px', border: `2px solid ${getStampColor(ptType)}`, color: getStampColor(ptType), padding: '2px 4px', fontSize: '10px', fontWeight: 'bold', transform: 'rotate(10deg)', opacity: 0.8, borderRadius: '2px', fontFamily: 'sans-serif' }}>
                                        START
                                    </div>
                                )}

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

            {/* 🌟 チェックポイントタブ */}
            {currentTab === 'checkpoint' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px', paddingBottom: '20px' }}>
                    {cpPoints.length === 0 ? (
                        <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 20px', backgroundColor: '#fffbe6', border: '2px dashed #d46b08', borderRadius: '4px', color: '#d46b08', fontWeight: 'bold' }}>
                            <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔍</div>
                            隠されたポイントを探しましょう！
                        </div>
                    ) : (
                        cpPoints.map(({ point: p, index: i }) => {
                            const isChecked = checkedPoints.includes(i);
                            return (
                                <div key={i} onClick={() => toggleCheck(i)} style={{ backgroundColor: isChecked ? '#eaddc5' : '#fffbe6', border: '2px solid #d46b08', borderRadius: '4px', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: isChecked ? 'inset 2px 2px 5px rgba(0,0,0,0.2)' : '2px 2px 4px rgba(0,0,0,0.1)', position: 'relative', opacity: isChecked ? 0.7 : 1 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px', borderBottom: '1px solid #eaddc5', paddingBottom: '4px' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#d46b08' }}>発見!</div>
                                        <div style={{ fontSize: '16px', color: isChecked ? '#cf1322' : '#ccc' }}>{isChecked ? '☑️' : '⬜️'}</div>
                                    </div>
                                    <div style={{ position: 'absolute', top: '25px', right: '5px', border: `2px solid #d46b08`, color: '#d46b08', padding: '2px 4px', fontSize: '10px', fontWeight: 'bold', transform: 'rotate(10deg)', opacity: 0.8, borderRadius: '2px', fontFamily: 'sans-serif' }}>
                                        CHK
                                    </div>
                                    <div style={{ width: '100%', height: '80px', display: 'flex', justifyContent: 'center' }} dangerouslySetInnerHTML={{ __html: p.svgCode || '' }} />
                                    <div style={{ fontSize: '16px', marginTop: '8px', textAlign: 'center', fontWeight: 'bold' }}>{p.instruction}</div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* 🌟 ゴール達成時の演出オーバーレイ（簡易） */}
            {isGoalReached && (
                <div style={{ position: 'fixed', bottom: '20px', left: '20px', right: '20px', background: '#cf1322', color: 'white', padding: '20px', borderRadius: '12px', textAlign: 'center', boxShadow: '0 4px 15px rgba(0,0,0,0.3)', zIndex: 1000, animation: 'slideUp 0.5s ease-out' }}>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '5px' }}>🏁 GOAL REACHED! 🏁</div>
                    <div style={{ fontSize: '16px' }}>お疲れ様でした！冒険完了です！</div>
                </div>
            )}

            <style>{`
                @keyframes slideUp {
                    from { transform: translateY(100%); opacity: 0; }
                    to { transform: translateY(0); opacity: 1; }
                }
            `}</style>
        </div>
    );
}