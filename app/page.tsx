// app/page.tsx
'use client';

import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '../utils/supabase';

const Map = dynamic(() => import('../components/Map'), { ssr: false });

type Point = { lat: number; lng: number; instruction: string; direction: string };
// 🌟 データベースから取得するコースの型を定義
type Course = { id: string; title: string; points: Point[] };

const DIRECTION_OPTIONS = ['📍 指定なし', '⬆️ 直進', '➡️ 右折', '⬅️ 左折', '↗️ 斜め右', '↖️ 斜め左', '↪️ Uターン', '🏁 ゴール'];

export default function Home() {
    const [points, setPoints] = useState<Point[]>([]);
    const [isBrowser, setIsBrowser] = useState(false);
    const [title, setTitle] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    // 🌟 追加：保存されたコース一覧と、現在編集中のコースIDを管理
    const [courses, setCourses] = useState<Course[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);

    // 🌟 追加：画面が開いたときにSupabaseからコース一覧を取得する
    useEffect(() => {
        setIsBrowser(true);
        fetchCourses();
    }, []);

    const fetchCourses = async () => {
        const { data, error } = await supabase
            .from('courses')
            .select('*')
            .order('created_at', { ascending: false }); // 新しい順に取得

        if (data) {
            setCourses(data);
        } else if (error) {
            console.error('コースの取得に失敗しました:', error);
        }
    };

    // 🌟 追加：プルダウンからコースを選んだ時の処理（読み込み）
    const handleLoadCourse = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedId = e.target.value;
        if (!selectedId) {
            // 「新規コース作成」が選ばれたらリセットする
            setEditingId(null);
            setTitle('');
            setPoints([]);
            return;
        }

        // 選ばれたコースのデータをStateにセットする
        const selectedCourse = courses.find(c => c.id === selectedId);
        if (selectedCourse) {
            setEditingId(selectedCourse.id);
            setTitle(selectedCourse.title);
            setPoints(selectedCourse.points);
        }
    };

    const handleMapClick = (lat: number, lng: number) => {
        setPoints([...points, { lat, lng, instruction: '', direction: '📍 指定なし' }]);
    };

    const updatePoint = (index: number, field: 'instruction' | 'direction', value: string) => {
        const newPoints = [...points];
        newPoints[index][field] = value;
        setPoints(newPoints);
    };

    const removePoint = (index: number) => {
        setPoints(points.filter((_, i) => i !== index));
    };

    const handleUndo = () => {
        setPoints(points.slice(0, -1));
    };

    const handleClear = () => {
        if (confirm('本当に地図上のピンをすべてクリアしますか？')) {
            setPoints([]);
        }
    };

    const onDragEnd = (result: DropResult) => {
        if (!result.destination) return;
        const items = Array.from(points);
        const [reorderedItem] = items.splice(result.source.index, 1);
        items.splice(result.destination.index, 0, reorderedItem);
        setPoints(items);
    };

    // 🌟 変更：保存処理（新規作成と上書き保存を分岐させる）
    const saveCourse = async () => {
        if (!title) {
            alert('コース名を入力してください！');
            return;
        }
        if (points.length === 0) {
            alert('地図にピンを打ってコースを作成してください！');
            return;
        }

        setIsSaving(true);

        try {
            if (editingId) {
                // 編集中のIDがある場合は「UPDATE（上書き）」
                const { error } = await supabase
                    .from('courses')
                    .update({ title: title, points: points })
                    .eq('id', editingId);
                if (error) throw error;
                alert('🔄 コースを上書き保存しました！');
            } else {
                // IDがない場合は「INSERT（新規作成）」
                const { error } = await supabase
                    .from('courses')
                    .insert([{ title: title, points: points }]);
                if (error) throw error;
                alert('🎉 新しいコースとして保存しました！');
            }

            // 保存が終わったら、コース一覧を最新状態に更新する
            fetchCourses();

        } catch (error: any) {
            console.error('保存エラー:', error.message);
            alert('保存に失敗しました。');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1>コマ地図ウォークラリー：コース作成</h1>

            {/* 🌟 管理パネル：読み込みと保存のUIをまとめる */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px', padding: '15px', backgroundColor: '#f0f2f5', border: '1px solid #d9d9d9', borderRadius: '8px' }}>

                {/* 上段：コース読み込みプルダウン */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <strong style={{ whiteSpace: 'nowrap' }}>📂 読み込み:</strong>
                    <select
                        value={editingId || ''}
                        onChange={handleLoadCourse}
                        style={{ flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer' }}
                    >
                        <option value="">＋ 新規コース作成（マップをクリア）</option>
                        {courses.map(c => (
                            <option key={c.id} value={c.id}>{c.title}</option>
                        ))}
                    </select>
                </div>

                {/* 下段：コース名入力と保存ボタン */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                    <strong style={{ whiteSpace: 'nowrap' }}>✏️ コース名:</strong>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="例：秋の京都巡りコース"
                        style={{ flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                    />
                    <button
                        onClick={saveCourse}
                        disabled={isSaving}
                        style={{ padding: '8px 24px', backgroundColor: editingId ? '#52c41a' : '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                        {isSaving ? '⏳ 保存中...' : (editingId ? '🔄 上書き保存' : '💾 新規保存')}
                    </button>
                </div>
            </div>

            <div style={{ marginBottom: '15px' }}>
                <button onClick={handleUndo} disabled={points.length === 0} style={{ marginRight: '10px', padding: '8px 16px', cursor: 'pointer' }}>
                    ↩️ 最後のピンを戻す
                </button>
                <button onClick={handleClear} disabled={points.length === 0} style={{ padding: '8px 16px', color: 'red', cursor: 'pointer' }}>
                    🗑️ すべてクリア
                </button>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: '1', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                    <Map points={points} onMapClick={handleMapClick} />
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
                                                        <div
                                                            ref={provided.innerRef} {...provided.draggableProps}
                                                            style={{
                                                                padding: '10px', backgroundColor: snapshot.isDragging ? '#e6f7ff' : '#fff',
                                                                border: '1px solid #eee', borderRadius: '6px',
                                                                boxShadow: snapshot.isDragging ? '0 4px 8px rgba(0,0,0,0.1)' : 'none',
                                                                ...provided.draggableProps.style
                                                            }}
                                                        >
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                                                <div {...provided.dragHandleProps} style={{ cursor: 'grab', marginRight: '10px', color: '#999' }}>
                                                                    <span style={{ fontSize: '18px' }}>≡</span>
                                                                    <strong style={{ fontSize: '14px', color: '#333' }}>ポイント {i + 1}</strong>
                                                                </div>
                                                                <button onClick={() => removePoint(i)} style={{ border: 'none', background: 'transparent', color: 'red', cursor: 'pointer', fontSize: '12px' }}>
                                                                    ❌ 削除
                                                                </button>
                                                            </div>

                                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                                <select value={p.direction} onChange={(e) => updatePoint(i, 'direction', e.target.value)} style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ccc', cursor: 'pointer' }}>
                                                                    {DIRECTION_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                </select>
                                                                <input type="text" value={p.instruction} onChange={(e) => updatePoint(i, 'instruction', e.target.value)} placeholder="例：T字路を右折" style={{ flex: '1', padding: '6px', border: '1px solid #ccc', borderRadius: '4px' }} />
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