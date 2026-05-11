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
    const [discoveredIndices, setDiscoveredIndices] = useState<number[]>([]);

    useEffect(() => {
        const fetchCourses = async () => {
            const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
            if (data) setCourses(data);
        };
        fetchCourses();
    }, []);

    // 🌟 コース選択時に「スタート」「道順」「ゴール」だけを初期表示にする
    useEffect(() => {
        if (selectedCourse) {
            const initialIndices = selectedCourse.points
                .map((p, i) => (p.pointType !== 'チェックポイント' ? i : -1))
                .filter(i => i !== -1);
            setDiscoveredIndices(initialIndices);
        }
    }, [selectedCourse]);

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

    // 🌟 GPS移動時のチェックポイント発見ロジック
    useEffect(() => {
        if (currentLoc && selectedCourse) {
            selectedCourse.points.forEach((p, i) => {
                const dist = getDistance(currentLoc.lat, currentLoc.lng, p.lat, p.lng);
                const threshold = p.radius || 5;

                // 未発見のチェックポイントの到達範囲内に入ったら発見！
                if (dist <= threshold && !discoveredIndices.includes(i) && p.pointType === 'チェックポイント') {
                    setDiscoveredIndices(prev => [...prev, i].sort((a, b) => a - b));
                    alert(`✨ チェックポイント到達！\n新たな指示が追加されました。`);
                }
            });
        }
    }, [currentLoc, selectedCourse, discoveredIndices]);

    if (!selectedCourse) {
        return (
            <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: '"Zen Kurenaido", sans-serif', backgroundColor: '#fdf6e3', minHeight: '100vh', color: '#5c3a21' }}>
                <style>{`@import url('https://fonts.googleapis.com/css2?family=Zen+Kurenaido&display=swap');`}</style>
                <h1 style={{ textAlign: 'center', borderBottom: '2px dashed #8b5a2b', paddingBottom: '10px' }}>🧭 冒険のコースを選ぶ</h1>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '30px' }}>
                    {courses.map(course => (
                        <button key={course.id} onClick={() => { setSelectedCourse(course); setCheckedPoints([]); setDiscoveredIndices([]); setIsGpsActive(false); }} style={{ padding: '20px', fontSize: '20px', fontWeight: 'bold', backgroundColor: '#fbf4e6', border: '2px solid #8b5a2b', borderRadius: '4px', color: '#5c3a21', cursor: 'pointer', boxShadow: '2px 2px 0px #8b5a2b', fontFamily: 'inherit' }}>
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
        return '#595959';
    };

    // 🌟 到達済みのチェックポイントのリストを作成
    const discoveredCheckpoints = discoveredIndices
        .filter(i => selectedCourse.points[i].pointType === 'チェックポイント')
        .map(i => ({ index: i, point: selectedCourse.points[i] }));

    return (
        <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto', fontFamily: '"Zen Kurenaido", sans-serif', backgroundColor: '#fdf6e3', minHeight: '100vh', display: 'flex', flexDirection: 'column', color: '#5c3a21' }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Zen+Kurenaido&display=swap');`}</style>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                <button onClick={() => setSelectedCourse(null)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #8b5a2b', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 'bold' }}>
                    ↩️ 閉じる
                </button>
                <div style={{ fontWeight: 'bold', fontSize: '18px' }}>
                    チェック済: {checkedPoints.length} / {discoveredIndices.length}
                </div>
            </div>

            <h2 style={{ textAlign: 'center', marginTop: 0, borderBottom: '2px dashed #8b5a2b', paddingBottom: '10px' }}>{selectedCourse.title}</h2>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fbf4e6', padding: '10px 15px', borderRadius: '4px', border: '1px solid #8b5a2b', marginBottom: '20px' }}>
                <button onClick={toggleGps} style={{ padding: '6px 12px', borderRadius: '4px', border: '1px solid #5c3a21', backgroundColor: isGpsActive ? '#fdf6e3' : '#eaddc5', color: '#5c3a21', fontWeight: 'bold', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {isGpsActive ? '🛰️ 測位中...' : '📍 GPS連動'}
                </button>
                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#666' }}>
                    ※ポイントに近づくと地図が追加されます
                </div>
            </div>

            {/* 🌟 追加：到達したチェックポイントの指示を記録するログエリア */}
            {discoveredCheckpoints.length > 0 && (
                <div style={{ backgroundColor: '#fffbe6', border: '2px solid #d46b08', padding: '15px', borderRadius: '4px', marginBottom: '20px', boxShadow: '2px 2px 0px #d46b08' }}>
                    <h3 style={{ margin: '0 0 10px 0', color: '#d46b08', borderBottom: '1px dashed #d46b08', paddingBottom: '5px' }}>
                        📜 冒険の記録（到達ポイントの指示）
                    </h3>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: '#5c3a21', fontWeight: 'bold', fontSize: '18px' }}>
                        {discoveredCheckpoints.map(({ index, point }) => (
                            <li key={index} style={{ marginBottom: '5px' }}>
                                Pt.{index + 1}: {point.instruction || '（指示なし）'}
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* 🌟 リストビュー（1枚ずつ見るビューは削除済） */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '15px', paddingBottom: '20px' }}>
                {selectedCourse.points.map((p, i) => {
                    if (!discoveredIndices.includes(i)) return null; // 未発見のポイントは表示しない

                    const isChecked = checkedPoints.includes(i);
                    const ptType = p.pointType;

                    return (
                        <div key={i} onClick={() => toggleCheck(i)} style={{ backgroundColor: isChecked ? '#eaddc5' : '#fbf4e6', border: '2px solid #8b5a2b', borderRadius: '4px', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: isChecked ? 'inset 2px 2px 5px rgba(0,0,0,0.2)' : '2px 2px 4px rgba(0,0,0,0.1)', position: 'relative', opacity: isChecked ? 0.7 : 1 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '8px', borderBottom: '1px solid #eaddc5', paddingBottom: '4px' }}>
                                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>Pt.{i + 1}</div>
                                <div style={{ fontSize: '16px', color: isChecked ? '#cf1322' : '#ccc' }}>{isChecked ? '☑️' : '⬜️'}</div>
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

                            <div style={{ fontSize: '16px', marginTop: '8px', textAlign: 'center', fontWeight: 'bold' }}>{p.instruction}</div>

                            {isChecked && (
                                <div style={{ position: 'absolute', top: '50%', left: '10%', right: '10%', height: '4px', backgroundColor: '#cf1322', transform: 'rotate(-20deg)', opacity: 0.5, borderRadius: '2px' }} />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}