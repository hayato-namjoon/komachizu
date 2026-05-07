// app/page.tsx
'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../utils/supabase';
import { generateAIPrompt } from '../utils/promptGenerator';

const Map = dynamic(() => import('../components/Map'), { ssr: false });

// 🌟 変更: svgCode を追加
type Point = { lat: number; lng: number; instruction: string; direction: string; svgCode?: string };
type Course = { id: string; title: string; points: Point[] };

const DIRECTION_OPTIONS = ['📍 指定なし', '⬆️ 直進', '➡️ 右折', '⬅️ 左折', '↗️ 斜め右', '↖️ 斜め左', '↪️ Uターン', '🏁 ゴール'];

export default function Home() {
    const [points, setPoints] = useState<Point[]>([]);
    const [isBrowser, setIsBrowser] = useState(false);
    const [title, setTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [courses, setCourses] = useState<Course[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number]>([35.6812, 139.7671]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);

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
        setIsSearching(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            if (data && data.length > 0) {
                setMapCenter([parseFloat(data[0].lat), parseFloat(data[0].lon)]);
            } else {
                alert('場所が見つかりませんでした。');
            }
        } catch (error) {
            alert('検索中にエラーが発生しました。');
        } finally {
            setIsSearching(false);
        }
    };

    const handleLoadCourse = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        if (!selectedId) { setEditingId(null); setTitle(''); setPoints([]); return; }
        const selectedCourse = courses.find(c => c.id === selectedId);
        if (selectedCourse) {
            setEditingId(selectedCourse.id);
            setTitle(selectedCourse.title);
            setPoints(selectedCourse.points);
            if (selectedCourse.points.length > 0) setMapCenter([selectedCourse.points[0].lat, selectedCourse.points[0].lng]);
        }
    };

    // 🌟 変更: 新規追加時に svgCode の空文字をセット
    const handleMapClick = (lat: number, lng: number) => {
        setPoints([...points, { lat, lng, instruction: '', direction: '📍 指定なし', svgCode: '' }]);
    };

    // 🌟 変更: svgCode も更新できるように型の制限を緩和
    const updatePoint = (index: number, field: keyof Point, value: string) => {
        const newPoints = [...points];
        newPoints[index] = { ...newPoints[index], [field]: value };
        setPoints(newPoints);
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
        if (!title) return alert('コース名を入力してください！');
        if (points.length === 0) return alert('地図にピンを打ってコースを作成してください！');
        setIsSaving(true);
        try {
            if (editingId) {
                await supabase.from('courses').update({ title, points }).eq('id', editingId);
                alert('🔄 コースを上書き保存しました！');
            } else {
                await supabase.from('courses').insert([{ title, points }]);
                alert('🎉 新しいコースとして保存しました！');
            }
            fetchCourses();
        } catch (error) {
            alert('保存に失敗しました。');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopyPrompt = () => {
        if (!title || points.length < 2) {
            alert('コース名を入力し、ピンを2つ以上打ってから生成してください。');
            return;
        }
        const promptText = generateAIPrompt(title, points);
        navigator.clipboard.writeText(promptText)
            .then(() => alert('🤖 AIへの依頼プロンプトをコピーしました！ChatGPTなどに貼り付けてください。'))
            .catch(() => alert('コピーに失敗しました。ブラウザの権限を確認してください。'));
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1>コマ地図ウォークラリー：コース作成</h1>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', padding: '15px', backgroundColor: '#f0f2f5', border: '1px solid #d9d9d9', borderRadius: '8px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <strong style={{ whiteSpace: 'nowrap' }}>📂 読み込み:</strong>
                    <select value={editingId || ''} onChange={handleLoadCourse} style={{ flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                        <option value="">＋ 新規コース作成（マップをクリア）</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <strong style={{ whiteSpace: 'nowrap' }}>✏️ コース名:</strong>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：秋の京都巡りコース" style={{ flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                    <button onClick={saveCourse} disabled={isSaving} style={{ padding: '8px 24px', backgroundColor: editingId ? '#52c41a' : '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        {isSaving ? '⏳ 保存中...' : (editingId ? '🔄 上書き保存' : '💾 新規保存')}
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', padding: '15px', backgroundColor: '#e6f7ff', borderRadius: '8px', border: '1px solid #91d5ff' }}>
                <strong style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>🔍 地図を移動:</strong>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()} placeholder="都道府県、市区町村、または郵便番号（例: 北海道, 100-0001）" style={{ flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #91d5ff' }} />
                <button onClick={handleSearchLocation} disabled={isSearching} style={{ padding: '8px 16px', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{isSearching ? '検索中...' : 'ジャンプ 🚀'}</button>
            </div>

            <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                    <button onClick={handleUndo} disabled={points.length === 0} style={{ marginRight: '10px', padding: '8px 16px', cursor: 'pointer' }}>↩️ 最後のピンを戻す</button>
                    <button onClick={handleClear} disabled={points.length === 0} style={{ padding: '8px 16px', color: 'red', cursor: 'pointer' }}>🗑️ すべてクリア</button>
                </div>
                <button onClick={handleCopyPrompt} style={{ padding: '8px 16px', backgroundColor: '#722ed1', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    🤖 AI用プロンプトをコピー
                </button>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: '1', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                    <Map points={points} onMapClick={handleMapClick} center={mapCenter} />
                </div>

                <div style={{ width: '400px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9', maxHeight: '500px', overflowY: 'auto' }}>
                    <h3 style={{ marginTop: 0 }}>📍 チェックポイント一覧</h3>
                    {points.length === 0 ? (
                        <p style={{ color: '#666' }}>地図をクリックしてルートを作成してください。</p>
                    ) : (
                        isBrowser && (
                            <DragDropContext onDragEnd={onDragEnd}>
                                <Droppable droppableId="point-list">
                                    {(provided) => (
                                        <div {...provided.droppableProps} ref={provided.innerRef} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            {points.map((p, i) => (
                                                <Draggable key={`point-${i}`} draggableId={`point-${i}`} index={i}>
                                                    {(provided, snapshot) => (
                                                        <div ref={provided.innerRef} {...provided.draggableProps} style={{ padding: '15px', backgroundColor: snapshot.isDragging ? '#e6f7ff' : '#fff', border: '1px solid #eee', borderRadius: '6px', ...provided.draggableProps.style }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                                <div {...provided.dragHandleProps} style={{ cursor: 'grab', marginRight: '10px', color: '#999' }}>
                                                                    <span style={{ fontSize: '18px' }}>≡</span> <strong>ポイント {i + 1}</strong>
                                                                </div>
                                                                <button onClick={() => removePoint(i)} style={{ border: 'none', background: 'transparent', color: 'red', cursor: 'pointer', fontSize: '12px' }}>❌ 削除</button>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                                                <select value={p.direction} onChange={(e) => updatePoint(i, 'direction', e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }}>
                                                                    {DIRECTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                </select>
                                                                <input type="text" value={p.instruction} onChange={(e) => updatePoint(i, 'instruction', e.target.value)} placeholder="例：T字路を右折" style={{ flex: '1', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
                                                            </div>
                                                            {/* 🌟 追加: SVGコードを貼り付けるテキストエリア */}
                                                            <div>
                                                                <textarea
                                                                    value={p.svgCode || ''}
                                                                    onChange={(e) => updatePoint(i, 'svgCode', e.target.value)}
                                                                    placeholder="AIが生成したSVGコード（<svg>...</svg>）をここに貼り付け"
                                                                    style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', height: '60px', fontFamily: 'monospace', fontSize: '12px', resize: 'vertical' }}
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </DragDropContext>
                        )
                    )}
                </div>
            </div>
        </div>
    );
}