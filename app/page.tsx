// app/page.tsx
'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../utils/supabase';
import { generateAIPrompt, Point } from '../utils/promptGenerator';

const Map = dynamic(() => import('../components/Map'), { ssr: false });

type Course = { id: string; title: string; points: Point[] };

const DIRECTION_OPTIONS = ['📍 指定なし', '⬆️ 直進', '➡️ 右折', '⬅️ 左折', '↗️ 斜め右', '↖️ 斜め左', '↪️ Uターン', '🏁 ゴール'];
const SHAPE_OPTIONS = ['十字路', 'Y字路', 'T字路（突き当たり）', 'ト字路（右分岐）', '逆ト字路（左分岐）', 'その他（詳細設定）'];
const POINT_TYPES = ['スタート地点', 'ただの道順', 'チェックポイント', 'ゴール'];
const ROAD_STYLES = [{ label: '➖ 直線', value: 'normal' }, { label: '〰️ カーブ', value: 'curve' }, { label: '⚡ ギザギザ', value: 'zigzag' }];

const VALID_DIRECTIONS: Record<string, string[]> = {
    '十字路': ['⬆️ 直進', '➡️ 右折', '⬅️ 左折', '↪️ Uターン'],
    'Y字路': ['↗️ 斜め右', '↖️ 斜め左', '➡️ 右折', '⬅️ 左折'],
    'T字路（突き当たり）': ['➡️ 右折', '⬅️ 左折', '↪️ Uターン'],
    'ト字路（右分岐）': ['⬆️ 直進', '➡️ 右折', '↪️ Uターン'],
    '逆ト字路（左分岐）': ['⬆️ 直進', '⬅️ 左折', '↪️ Uターン'],
    'その他（詳細設定）': ['📍 指定なし', '⬆️ 直進', '➡️ 右折', '⬅️ 左折', '↗️ 斜め右', '↖️ 斜め左', '↪️ Uターン', '🏁 ゴール']
};

export default function Home() {
    const [points, setPoints] = useState<Point[]>([]);
    const [isBrowser, setIsBrowser] = useState(false);
    const [title, setTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([35.6812, 139.7671]);
    const [searchQuery, setSearchQuery] = useState('');
    const [showInstructions, setShowInstructions] = useState(false);
    const [bulkSvgInput, setBulkSvgInput] = useState('');

    useEffect(() => { setIsBrowser(true); fetchCourses(); }, []);

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

    const handleMapClick = (lat: number, lng: number) => {
        const initialType = points.length === 0 ? 'スタート地点' : 'ただの道順';
        setPoints([...points, { lat, lng, instruction: '', direction: '⬆️ 直進', svgCode: '', intersectionShape: '十字路', clockPositions: [12], correctClock: 12, customNote: '', pointType: initialType, radius: 5, landmark: '' }]);
    };

    const updatePoint = (index: number, field: keyof Point, value: any) => {
        const newPoints = [...points];
        newPoints[index] = { ...newPoints[index], [field]: value };
        if (field === 'intersectionShape') {
            const allowedDirs = VALID_DIRECTIONS[value as string] || VALID_DIRECTIONS['その他（詳細設定）'];
            if (!allowedDirs.includes(newPoints[index].direction)) newPoints[index].direction = allowedDirs[0];
        }
        setPoints(newPoints);
    };

    const toggleClockPosition = (index: number, hour: number) => {
        const currentPoint = points[index];
        let newPositions = currentPoint.clockPositions || [];
        if (newPositions.includes(hour)) newPositions = newPositions.filter(h => h !== hour);
        else newPositions = [...newPositions, hour].sort((a, b) => a - b);
        updatePoint(index, 'clockPositions', newPositions);
        if (!newPositions.includes(currentPoint.correctClock || 12) && newPositions.length > 0) updatePoint(index, 'correctClock', newPositions[0]);
    };

    const toggleNoEntry = (index: number, hour: number) => {
        const currentPoint = points[index];
        let newNoEntries = currentPoint.noEntryClocks || [];
        if (newNoEntries.includes(hour)) newNoEntries = newNoEntries.filter(h => h !== hour);
        else newNoEntries = [...newNoEntries, hour].sort((a, b) => a - b);
        updatePoint(index, 'noEntryClocks', newNoEntries);
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
        const existingCourse = courses.find(c => c.title === title && c.id !== editingId);
        let targetId = editingId;
        if (existingCourse) {
            if (!confirm(`「${title}」に上書き保存しますか？`)) return;
            targetId = existingCourse.id;
        }
        setIsSaving(true);
        try {
            if (targetId) { await supabase.from('courses').update({ title, points }).eq('id', targetId); alert('🔄 上書き保存しました！'); }
            else { await supabase.from('courses').insert([{ title, points }]); alert('🎉 新規保存しました！'); }
            fetchCourses();
            if (targetId && targetId !== editingId) setEditingId(targetId);
        } catch (error) { alert('保存に失敗しました。'); } finally { setIsSaving(false); }
    };

    const deleteCourse = async () => {
        if (!editingId) return;
        if (!confirm(`コース「${title}」を削除しますか？`)) return;
        try {
            await supabase.from('courses').delete().eq('id', editingId); alert('🗑️ 削除しました。');
            setEditingId(null); setTitle(''); setPoints([]); fetchCourses();
        } catch (error) { alert('削除に失敗しました。'); }
    };

    const handleCopyPrompt = () => {
        if (!title || points.length < 2) return alert('コース名と2つ以上のピンが必要です。');
        navigator.clipboard.writeText(generateAIPrompt(title, points)).then(() => alert('🤖 プロンプトをコピーしました！'));
    };

    const handleApplyBulkSvg = () => {
        if (!bulkSvgInput.trim()) return alert('AIの回答がありません！');
        const matches = bulkSvgInput.match(/<svg[\s\S]*?<\/svg>/gi);
        if (!matches) return alert('SVGコードが見つかりません。');
        let matchIndex = 0;
        const newPoints = points.map(p => {
            if (p.pointType !== 'ゴール' && matchIndex < matches.length) {
                const svgCode = matches[matchIndex]; matchIndex++; return { ...p, svgCode };
            }
            return p;
        });
        setPoints(newPoints); setBulkSvgInput(''); alert(`✨ ${matchIndex}個のSVGを振り分けました！`);
    };

    const getHeaderColor = (type?: string) => {
        if (type === 'スタート地点') return '#0050b3';
        if (type === 'ゴール') return '#a8071a';
        if (type === 'チェックポイント') return '#ad4e00';
        return '#333';
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', fontFamily: '"Zen Kurenaido", sans-serif', backgroundColor: '#fdf6e3', minHeight: '100vh', color: '#5c3a21' }}>
            <style>{`@import url('https://fonts.googleapis.com/css2?family=Zen+Kurenaido&display=swap');`}</style>
            <h1 style={{ textAlign: 'center', borderBottom: '2px dashed #8b5a2b', paddingBottom: '10px' }}>📚 コマ地図ウォークラリー：システム管理</h1>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', padding: '15px', backgroundColor: '#eaddc5', borderRadius: '8px', border: '1px solid #8b5a2b' }}>
                <select value={editingId || ''} onChange={handleLoadCourse} style={{ flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #8b5a2b', background: '#fdf6e3', fontFamily: 'inherit', fontWeight: 'bold' }}>
                    <option value="">＋ 新規コース作成</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                {editingId && <button onClick={deleteCourse} style={{ padding: '8px 16px', backgroundColor: '#8b0000', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️ 削除</button>}
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="コース名" style={{ flex: '2', padding: '8px', borderRadius: '4px', border: '1px solid #8b5a2b', background: '#fdf6e3', fontFamily: 'inherit' }} />
                <button onClick={saveCourse} disabled={isSaving} style={{ padding: '8px 24px', backgroundColor: '#5c3a21', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {isSaving ? '⏳ 保存中...' : '💾 保存'}
                </button>
            </div>

            <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f5ebff', border: '2px dashed #722ed1', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, color: '#531dab' }}>🤖 AI連携エリア（一括生成）</h3>
                    <div>
                        <button onClick={handleUndo} disabled={points.length === 0} style={{ marginRight: '10px', padding: '6px 12px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff', fontFamily: 'inherit' }}>↩️ 戻す</button>
                        <button onClick={handleClear} disabled={points.length === 0} style={{ padding: '6px 12px', color: 'red', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ffccc7', backgroundColor: '#fff2f0', fontFamily: 'inherit' }}>🗑️ クリア</button>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button onClick={handleCopyPrompt} style={{ padding: '10px', backgroundColor: '#722ed1', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit' }}>1. 📋 AI用プロンプトをコピーする</button>
                    <textarea value={bulkSvgInput} onChange={(e) => setBulkSvgInput(e.target.value)} placeholder="2. ChatGPT等が出力した回答（SVGコード群）をここに貼り付け" style={{ width: '100%', height: '80px', padding: '10px', borderRadius: '4px', border: '1px solid #d3adf7', fontFamily: 'monospace', fontSize: '13px' }} />
                    <button onClick={handleApplyBulkSvg} style={{ padding: '10px', backgroundColor: '#eb2f96', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', fontFamily: 'inherit' }}>3. ✨ コピーしたSVGを各ポイントに一括流し込み！</button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: '1', border: '3px solid #8b5a2b', borderRadius: '4px', overflow: 'hidden', backgroundColor: '#eaddc5', padding: '5px' }}>
                    <div style={{ padding: '8px', marginBottom: '5px', backgroundColor: '#fdf6e3', border: '1px solid #8b5a2b', display: 'flex', gap: '10px' }}>
                        <strong style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>🔍 地図を移動:</strong>
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()} placeholder="住所や郵便番号" style={{ flex: '1', padding: '6px', borderRadius: '4px', border: '1px solid #ccc', fontFamily: 'inherit' }} />
                        <button onClick={handleSearchLocation} style={{ padding: '6px 12px', backgroundColor: '#5c3a21', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontFamily: 'inherit' }}>ジャンプ</button>
                    </div>
                    <div style={{ border: '2px solid #8b5a2b' }}>
                        <Map center={mapCenter} onMapClick={handleMapClick} points={points} />
                    </div>
                </div>

                <div style={{ width: '480px', padding: '15px', border: '2px solid #8b5a2b', borderRadius: '8px', backgroundColor: '#fbf4e6', maxHeight: '750px', overflowY: 'auto', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.05)' }}>
                    <h3 style={{ marginTop: 0, borderBottom: '2px dashed #8b5a2b', paddingBottom: '10px' }}>📍 チェックポイント一覧</h3>
                    {isBrowser && (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="point-list">
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        {points.map((p, i) => {
                                            const currentAllowedDirections = VALID_DIRECTIONS[p.intersectionShape || '十字路'] || VALID_DIRECTIONS['その他（詳細設定）'];
                                            const isGoal = p.pointType === 'ゴール';

                                            return (
                                                <Draggable draggableId={`point-${i}`} index={i} key={`point-${i}`}>
                                                    {(provided, snapshot) => (
                                                        <div ref={provided.innerRef} {...provided.draggableProps} style={{ padding: '15px', backgroundColor: snapshot.isDragging ? '#fffbe6' : '#fdf6e3', border: '1px solid #8b5a2b', borderRadius: '4px', boxShadow: '2px 2px 4px rgba(0,0,0,0.1)', ...provided.draggableProps.style }}>

                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', borderBottom: '1px solid #eaddc5', paddingBottom: '5px' }}>
                                                                <div {...provided.dragHandleProps} style={{ cursor: 'grab', fontWeight: 'bold', fontSize: '18px', color: getHeaderColor(p.pointType) }}>
                                                                    ≡ Pt. {i + 1} {p.pointType ? `(${p.pointType})` : ''}
                                                                </div>
                                                                <button onClick={() => removePoint(i)} style={{ color: '#a8071a', border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>❌</button>
                                                            </div>

                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                                                <strong style={{ whiteSpace: 'nowrap', color: '#5c3a21' }}>🚩 役割:</strong>
                                                                <select value={p.pointType || 'ただの道順'} onChange={(e) => updatePoint(i, 'pointType', e.target.value)} style={{ padding: '4px', flex: 1, borderRadius: '4px', border: '1px solid #8b5a2b', fontWeight: 'bold', fontFamily: 'inherit', background: '#fff' }}>
                                                                    {POINT_TYPES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                </select>
                                                            </div>

                                                            {/* 🌟 追加：ストリートビュー連携ボタン */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                                                                <a
                                                                    href={`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${p.lat},${p.lng}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    style={{ padding: '6px 12px', backgroundColor: '#096dd9', color: 'white', textDecoration: 'none', borderRadius: '4px', fontSize: '14px', fontWeight: 'bold', width: '100%', textAlign: 'center', fontFamily: 'inherit' }}
                                                                >
                                                                    👀 この場所のストリートビューを開く
                                                                </a>
                                                            </div>

                                                            {!isGoal && (
                                                                <div style={{ padding: '12px', backgroundColor: '#eaddc5', borderRadius: '4px', border: '1px solid #8b5a2b', marginBottom: '10px' }}>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                                                        <strong style={{ whiteSpace: 'nowrap' }}>🗺️ 形状:</strong>
                                                                        <select value={p.intersectionShape || '十字路'} onChange={(e) => updatePoint(i, 'intersectionShape', e.target.value)} style={{ padding: '4px', flex: 1, borderRadius: '4px', border: '1px solid #8b5a2b', fontFamily: 'inherit' }}>
                                                                            {SHAPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                        </select>
                                                                    </div>

                                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                                                                        <strong style={{ whiteSpace: 'nowrap' }}>➡️ 指示:</strong>
                                                                        <select value={p.direction} onChange={(e) => updatePoint(i, 'direction', e.target.value)} style={{ padding: '4px', width: '110px', borderRadius: '4px', border: '1px solid #8b5a2b', fontFamily: 'inherit' }}>
                                                                            {currentAllowedDirections.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                        </select>
                                                                        <input type="text" value={p.instruction} onChange={(e) => updatePoint(i, 'instruction', e.target.value)} placeholder="例：看板を右" style={{ flex: '1', padding: '4px', borderRadius: '4px', border: '1px solid #8b5a2b', fontFamily: 'inherit' }} />
                                                                    </div>

                                                                    {/* 🌟 追加：目印の入力欄 */}
                                                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', padding: '8px', backgroundColor: '#fff', border: '1px solid #d46b08', borderRadius: '4px' }}>
                                                                        <strong style={{ whiteSpace: 'nowrap', color: '#d46b08' }}>📌 目印:</strong>
                                                                        <input
                                                                            type="text"
                                                                            value={p.landmark || ''}
                                                                            onChange={(e) => updatePoint(i, 'landmark', e.target.value)}
                                                                            placeholder="例：右上の角に赤いポスト"
                                                                            style={{ flex: '1', padding: '4px', borderRadius: '4px', border: '1px solid #ccc', fontFamily: 'inherit' }}
                                                                        />
                                                                    </div>

                                                                    {/* ...（既存の clockPositions などのUI）... */}
                                                                    <input type="text" value={p.customNote || ''} onChange={(e) => updatePoint(i, 'customNote', e.target.value)} placeholder="AIへの補足（例: 中央に花壇）" style={{ width: '100%', padding: '4px', marginTop: '8px', fontSize: '13px', borderRadius: '4px', border: '1px solid #ccc', fontFamily: 'inherit' }} />
                                                                </div>
                                                            )}

                                                            {!isGoal ? (
                                                                <textarea value={p.svgCode || ''} onChange={(e) => updatePoint(i, 'svgCode', e.target.value)} placeholder="※一括流し込みで自動入力されます" style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', height: '50px', fontFamily: 'monospace', fontSize: '11px', background: '#f9f9f9' }} />
                                                            ) : (
                                                                <div style={{ width: '100%', padding: '8px', textAlign: 'center', color: '#a8071a', fontWeight: 'bold' }}>※ゴール地点は形状を記載しません</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </Draggable>
                                            );
                                        })}
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