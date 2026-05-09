// app/page.tsx
'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../utils/supabase';
import { generateAIPrompt, Point } from '../utils/promptGenerator'; // 🌟 更新したPoint型をインポート

const Map = dynamic(() => import('../components/Map'), { ssr: false });

type Course = { id: string; title: string; points: Point[] };

const DIRECTION_OPTIONS = ['📍 指定なし', '⬆️ 直進', '➡️ 右折', '⬅️ 左折', '↗️ 斜め右', '↖️ 斜め左', '↪️ Uターン', '🏁 ゴール'];
const SHAPE_OPTIONS = ['十字路', 'Y字路', 'T字路（突き当たり）', 'ト字路（右分岐）', '逆ト字路（左分岐）', 'その他（詳細設定）'];

export default function Home() {
    const [points, setPoints] = useState<Point[]>([]);
    const [isBrowser, setIsBrowser] = useState(false);
    const [title, setTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([35.6812, 139.7671]);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        setIsBrowser(true);
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        const { data } = await supabase.from('courses').select('*').order('created_at', { ascending: false });
        if (data) setCourses(data);
    };

    const handleSearchLocation = async () => {
        if (!searchQuery) return;
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            if (data && data.length > 0) setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
        } catch (error) { alert('検索エラーが発生しました。'); }
    };

    const handleLoadCourse = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        if (!selectedId) { setEditingId(null); setTitle(''); setPoints([]); return; }
        const selectedCourse = courses.find(c => c.id === selectedId);
        if (selectedCourse) {
            setEditingId(selectedCourse.id); setTitle(selectedCourse.title); setPoints(selectedCourse.points);
            if (selectedCourse.points.length > 0) setMapCenter([selectedCourse.points[0].lat, selectedCourse.points[0].lng]);
        }
    };

    // 新規ピン追加時の初期値
    const handleMapClick = (lat: number, lng: number) => {
        setPoints([...points, { lat, lng, instruction: '', direction: '📍 指定なし', svgCode: '', intersectionShape: '十字路', clockPositions: [12], correctClock: 12, customNote: '' }]);
    };

    const updatePoint = (index: number, field: keyof Point, value: any) => {
        const newPoints = [...points];
        newPoints[index] = { ...newPoints[index], [field]: value };
        setPoints(newPoints);
    };

    // 時計のチェックボックスをON/OFFする処理
    const toggleClockPosition = (index: number, hour: number) => {
        const currentPoint = points[index];
        let newPositions = currentPoint.clockPositions || [];
        if (newPositions.includes(hour)) {
            newPositions = newPositions.filter(h => h !== hour);
        } else {
            newPositions = [...newPositions, hour].sort((a, b) => a - b);
        }
        updatePoint(index, 'clockPositions', newPositions);

        // もし正解の方角がチェック外されたら、残っている最初の方角に直す
        if (!newPositions.includes(currentPoint.correctClock || 12) && newPositions.length > 0) {
            updatePoint(index, 'correctClock', newPositions[0]);
        }
    };

    const removePoint = (index: number) => { setPoints(points.filter((_, i) => i !== index)); };
    const handleUndo = () => { setPoints(points.slice(0, -1)); };
    const handleClear = () => { if (confirm('本当にクリアしますか？')) setPoints([]); };
    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const items = Array.from(points);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setPoints(items);
    };

    const saveCourse = async () => {
        if (!title || points.length === 0) return alert('コース名とピンの配置が必要です！');
        setIsSaving(true);
        try {
            if (editingId) await supabase.from('courses').update({ title, points }).eq('id', editingId);
            else await supabase.from('courses').insert([{ title, points }]);
            alert('保存しました！'); fetchCourses();
        } catch (error) { alert('保存に失敗しました。'); } finally { setIsSaving(false); }
    };

    const handleCopyPrompt = () => {
        const promptText = generateAIPrompt(title, points);
        navigator.clipboard.writeText(promptText).then(() => alert('🤖 プロンプトをコピーしました！'));
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1>コマ地図ウォークラリー：コース作成</h1>
            {/* 上部の保存UI等はそのまま */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', padding: '15px', backgroundColor: '#f0f2f5', borderRadius: '8px' }}>
                <select value={editingId || ''} onChange={handleLoadCourse} style={{ flex: '1', padding: '8px' }}>
                    <option value="">＋ 新規コース作成</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="コース名" style={{ flex: '2', padding: '8px' }} />
                <button onClick={saveCourse} disabled={isSaving} style={{ padding: '8px 24px', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '4px' }}>保存</button>
            </div>

            <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                    <button onClick={handleUndo} disabled={points.length === 0} style={{ marginRight: '10px', padding: '8px 16px' }}>↩️ 戻す</button>
                    <button onClick={handleClear} disabled={points.length === 0} style={{ padding: '8px 16px', color: 'red' }}>🗑️ クリア</button>
                </div>
                <button onClick={handleCopyPrompt} style={{ padding: '8px 16px', backgroundColor: '#722ed1', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>🤖 AI用プロンプトコピー</button>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: '1', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                    <Map points={points} onMapClick={handleMapClick} center={mapCenter} />
                </div>

                <div style={{ width: '450px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9', maxHeight: '600px', overflowY: 'auto' }}>
                    <h3 style={{ marginTop: 0 }}>📍 チェックポイント一覧</h3>
                    {isBrowser && (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="point-list">
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        {points.map((p, i) => (
                                            <Draggable key={`point-${i}`} draggableId={`point-${i}`} index={i}>
                                                {(provided, snapshot) => (
                                                    <div ref={provided.innerRef} {...provided.draggableProps} style={{ padding: '15px', backgroundColor: snapshot.isDragging ? '#e6f7ff' : '#fff', border: '1px solid #ddd', borderRadius: '8px', ...provided.draggableProps.style }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                            <div {...provided.dragHandleProps} style={{ cursor: 'grab', fontWeight: 'bold' }}>≡ ポイント {i + 1}</div>
                                                            <button onClick={() => removePoint(i)} style={{ color: 'red', border: 'none', background: 'none' }}>❌</button>
                                                        </div>

                                                        {/* アイコンとテキスト指示 */}
                                                        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                                                            <select value={p.direction} onChange={(e) => updatePoint(i, 'direction', e.target.value)} style={{ padding: '6px', width: '100px' }}>
                                                                {DIRECTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                            </select>
                                                            <input type="text" value={p.instruction} onChange={(e) => updatePoint(i, 'instruction', e.target.value)} placeholder="例：看板を右" style={{ flex: '1', padding: '6px' }} />
                                                        </div>

                                                        {/* 🌟 形状指定エリア */}
                                                        <div style={{ padding: '10px', backgroundColor: '#f0f5ff', borderRadius: '6px', marginBottom: '10px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '5px' }}>
                                                                <strong>🗺️ 形状:</strong>
                                                                <select value={p.intersectionShape || '十字路'} onChange={(e) => updatePoint(i, 'intersectionShape', e.target.value)} style={{ padding: '4px', flex: 1 }}>
                                                                    {SHAPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                </select>
                                                            </div>

                                                            {/* その他（詳細設定）が選ばれた時だけ表示される時計UI */}
                                                            {p.intersectionShape === 'その他（詳細設定）' && (
                                                                <div style={{ padding: '10px', backgroundColor: '#fff', border: '1px solid #bae0ff', borderRadius: '6px', marginTop: '10px' }}>
                                                                    <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>🕒 道がある方角にチェック（6時は固定）</p>
                                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                                                                        {[7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5].map(hour => (
                                                                            <label key={hour} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                                                <input type="checkbox" checked={(p.clockPositions || []).includes(hour)} onChange={() => toggleClockPosition(i, hour)} />
                                                                                {hour}時
                                                                            </label>
                                                                        ))}
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                        <strong style={{ fontSize: '13px' }}>🎯 進む方向:</strong>
                                                                        <select value={p.correctClock || 12} onChange={(e) => updatePoint(i, 'correctClock', Number(e.target.value))} style={{ padding: '4px' }}>
                                                                            {(p.clockPositions || []).length === 0 && <option value={12}>道を選択してください</option>}
                                                                            {(p.clockPositions || []).map(h => <option key={h} value={h}>{h}時へ進む</option>)}
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {/* フリーテキストの補足指示 */}
                                                            <input type="text" value={p.customNote || ''} onChange={(e) => updatePoint(i, 'customNote', e.target.value)} placeholder="AIへの補足（例: 中央に丸い花壇がある）" style={{ width: '100%', padding: '6px', marginTop: '8px', fontSize: '12px' }} />
                                                        </div>

                                                        {/* SVG貼り付け欄 */}
                                                        <textarea value={p.svgCode || ''} onChange={(e) => updatePoint(i, 'svgCode', e.target.value)} placeholder="AIが生成したSVGコード（<svg>...</svg>）をここに貼り付け" style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', height: '60px', fontFamily: 'monospace', fontSize: '12px' }} />
                                                    </div>
                                                )}
                                            </Draggable>
                                        ))}
                                        {provided.placeholder}
                                    </div>
                                )}
                            </Droppable>
                        </DragDropContext>
                    )}
                </div>
            </div>
        </div>
    );
}