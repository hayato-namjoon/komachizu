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

    const handleMapClick = (lat: number, lng: number) => {
        setPoints([...points, { lat, lng, instruction: '', direction: '⬆️ 直進', svgCode: '', intersectionShape: '十字路', clockPositions: [12], correctClock: 12, customNote: '' }]);
    };

    const updatePoint = (index: number, field: keyof Point, value: any) => {
        const newPoints = [...points];
        newPoints[index] = { ...newPoints[index], [field]: value };

        if (field === 'intersectionShape') {
            const allowedDirs = VALID_DIRECTIONS[value as string] || VALID_DIRECTIONS['その他（詳細設定）'];
            if (!allowedDirs.includes(newPoints[index].direction)) {
                newPoints[index].direction = allowedDirs[0];
            }
        }

        setPoints(newPoints);
    };

    const toggleClockPosition = (index: number, hour: number) => {
        const currentPoint = points[index];
        let newPositions = currentPoint.clockPositions || [];
        if (newPositions.includes(hour)) {
            newPositions = newPositions.filter(h => h !== hour);
        } else {
            newPositions = [...newPositions, hour].sort((a, b) => a - b);
        }
        updatePoint(index, 'clockPositions', newPositions);

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

    // 🌟 変更：同名チェックと上書き処理を追加
    const saveCourse = async () => {
        if (!title || points.length === 0) return alert('コース名とピンの配置が必要です！');

        // 入力されたコース名と同じ名前のコースが既に存在するかチェック（現在編集中のものを除く）
        const existingCourse = courses.find(c => c.title === title && c.id !== editingId);
        let targetId = editingId;

        if (existingCourse) {
            const confirmOverwrite = confirm(`「${title}」という名前のコースは既に存在します。\n上書き保存してもよろしいですか？`);
            if (!confirmOverwrite) return; // キャンセルした場合は処理を中断
            targetId = existingCourse.id;  // 既存コースのIDをターゲットにする
        }

        setIsSaving(true);
        try {
            if (targetId) {
                await supabase.from('courses').update({ title, points }).eq('id', targetId);
                alert('🔄 上書き保存しました！');
            } else {
                await supabase.from('courses').insert([{ title, points }]);
                alert('🎉 新規保存しました！');
            }
            fetchCourses();

            // 別のコースに上書きした場合、編集中のIDを更新しておく
            if (targetId && targetId !== editingId) {
                setEditingId(targetId);
            }
        } catch (error) {
            alert('保存に失敗しました。');
        } finally {
            setIsSaving(false);
        }
    };

    // 🌟 追加：コース削除処理
    const deleteCourse = async () => {
        if (!editingId) return;
        const confirmDelete = confirm(`本当にコース「${title}」を削除しますか？\nこの操作は取り消せません。`);
        if (!confirmDelete) return;

        try {
            await supabase.from('courses').delete().eq('id', editingId);
            alert('🗑️ コースを削除しました。');
            // 状態を初期化して新規作成モードに戻す
            setEditingId(null);
            setTitle('');
            setPoints([]);
            fetchCourses();
        } catch (error) {
            alert('削除に失敗しました。');
        }
    };

    const handleCopyPrompt = () => {
        const promptText = generateAIPrompt(title, points);
        navigator.clipboard.writeText(promptText).then(() => alert('🤖 プロンプトをコピーしました！'));
    };

    return (
        <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
            <h1>コマ地図ウォークラリー：コース作成</h1>

            <div style={{ marginBottom: '20px', backgroundColor: '#fffbe6', border: '1px solid #ffe58f', borderRadius: '8px', overflow: 'hidden' }}>
                <div onClick={() => setShowInstructions(!showInstructions)} style={{ padding: '12px 15px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff1b8', fontWeight: 'bold', color: '#d48806' }}>
                    <span>💡 コース作成の手順とコツ</span><span>{showInstructions ? '▲ 閉じる' : '▼ 開く'}</span>
                </div>
                {showInstructions && (
                    <div style={{ padding: '15px', color: '#5c3a21', fontSize: '14px', lineHeight: '1.6' }}>
                        <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '15px' }}>
                            <li><strong>マップにピンを打つ：</strong> 地図上をクリックしてルートを作成します。</li>
                            <li><strong>交差点の形状を設定する：</strong> 右側のリストから、交差点の形を選びます。選んだ形に合わせて、矛盾しない「正しい進行方向」しか選べないようになっています。
                                <div style={{ marginTop: '8px', padding: '12px', backgroundColor: '#fff', border: '1px solid #ffe58f', borderRadius: '6px' }}>
                                    <strong style={{ display: 'block', marginBottom: '5px', color: '#d48806' }}>🕒 「その他（詳細設定）」の使い方（時計の文字盤）</strong>
                                    <ul style={{ marginTop: '5px', marginBottom: '0', paddingLeft: '20px', color: '#8a5a19' }}>
                                        <li><strong>プレイヤーが歩いてくる道は常に「6時」</strong>です。</li>
                                        <li><strong>道が存在する方角</strong>にすべてチェックを入れます。</li>
                                        <li>最後に、その中から<strong>「進むべき正しい方向」</strong>を選びます。</li>
                                    </ul>
                                </div>
                            </li>
                            <li><strong>AI用プロンプトを生成：</strong> 「🤖 AI用プロンプトコピー」ボタンを押します。</li>
                            <li><strong>AIに画像を描かせる：</strong> ChatGPT等に貼り付け、出力された <code>&lt;svg&gt;...</code> を各ポイントの一番下の枠に貼り付けます。</li>
                            <li><strong>保存する：</strong> コース名をつけて保存します。<br /><span style={{ fontSize: '13px', color: '#8a5a19' }}>※既存のコースと同じ名前にした場合は、上書き保存されます。</span></li>
                        </ol>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', padding: '15px', backgroundColor: '#f0f2f5', borderRadius: '8px', alignItems: 'center' }}>
                <select value={editingId || ''} onChange={handleLoadCourse} style={{ flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="">＋ 新規コース作成</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>

                {/* 🌟 削除ボタンを追加（既存コースを開いている時だけ表示） */}
                {editingId && (
                    <button onClick={deleteCourse} style={{ padding: '8px 16px', backgroundColor: '#ff4d4f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                        🗑️ 削除
                    </button>
                )}

                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="コース名" style={{ flex: '2', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <button onClick={saveCourse} disabled={isSaving} style={{ padding: '8px 24px', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {isSaving ? '⏳ 保存中...' : '💾 保存'}
                </button>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '15px', padding: '15px', backgroundColor: '#e6f7ff', borderRadius: '8px', border: '1px solid #91d5ff' }}>
                <strong style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>🔍 地図を移動:</strong>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()} placeholder="都道府県、市区町村、または郵便番号" style={{ flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #91d5ff' }} />
                <button onClick={handleSearchLocation} style={{ padding: '8px 16px', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>ジャンプ 🚀</button>
            </div>

            <div style={{ marginBottom: '15px', display: 'flex', justifyContent: 'space-between' }}>
                <div>
                    <button onClick={handleUndo} disabled={points.length === 0} style={{ marginRight: '10px', padding: '8px 16px', cursor: 'pointer' }}>↩️ 戻す</button>
                    <button onClick={handleClear} disabled={points.length === 0} style={{ padding: '8px 16px', color: 'red', cursor: 'pointer' }}>🗑️ クリア</button>
                </div>
                <button onClick={handleCopyPrompt} style={{ padding: '8px 16px', backgroundColor: '#722ed1', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>🤖 AI用プロンプトコピー</button>
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
                                        {points.map((p, i) => {
                                            const currentAllowedDirections = VALID_DIRECTIONS[p.intersectionShape || '十字路'] || VALID_DIRECTIONS['その他（詳細設定）'];

                                            return (
                                                <Draggable key={`point-${i}`} draggableId={`point-${i}`} index={i}>
                                                    {(provided, snapshot) => (
                                                        <div ref={provided.innerRef} {...provided.draggableProps} style={{ padding: '15px', backgroundColor: snapshot.isDragging ? '#e6f7ff' : '#fff', border: '1px solid #ddd', borderRadius: '8px', ...provided.draggableProps.style }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                                <div {...provided.dragHandleProps} style={{ cursor: 'grab', fontWeight: 'bold' }}>≡ ポイント {i + 1}</div>
                                                                <button onClick={() => removePoint(i)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>❌</button>
                                                            </div>

                                                            <div style={{ padding: '10px', backgroundColor: '#f0f5ff', borderRadius: '6px', marginBottom: '10px' }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                                                                    <strong style={{ whiteSpace: 'nowrap' }}>🗺️ 形状:</strong>
                                                                    <select value={p.intersectionShape || '十字路'} onChange={(e) => updatePoint(i, 'intersectionShape', e.target.value)} style={{ padding: '6px', flex: 1, borderRadius: '4px', border: '1px solid #ccc' }}>
                                                                        {SHAPE_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                    </select>
                                                                </div>

                                                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                                                                    <strong style={{ whiteSpace: 'nowrap' }}>➡️ 指示:</strong>
                                                                    <select value={p.direction} onChange={(e) => updatePoint(i, 'direction', e.target.value)} style={{ padding: '6px', width: '120px', borderRadius: '4px', border: '1px solid #ccc' }}>
                                                                        {currentAllowedDirections.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                    </select>
                                                                    <input type="text" value={p.instruction} onChange={(e) => updatePoint(i, 'instruction', e.target.value)} placeholder="例：看板を右" style={{ flex: '1', padding: '6px', borderRadius: '4px', border: '1px solid #ccc' }} />
                                                                </div>

                                                                {p.intersectionShape === 'その他（詳細設定）' && (
                                                                    <div style={{ padding: '10px', backgroundColor: '#fff', border: '1px solid #bae0ff', borderRadius: '6px', marginTop: '10px' }}>
                                                                        <p style={{ margin: '0 0 5px 0', fontSize: '12px', color: '#666' }}>🕒 道がある方角にチェック（6時は固定）</p>
                                                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                                                                            {[7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5].map(hour => (
                                                                                <label key={hour} style={{ fontSize: '13px', display: 'flex', alignItems: 'center', gap: '2px', cursor: 'pointer' }}>
                                                                                    <input type="checkbox" checked={(p.clockPositions || []).includes(hour)} onChange={() => toggleClockPosition(i, hour)} />
                                                                                    {hour}時
                                                                                </label>
                                                                            ))}
                                                                        </div>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                            <strong style={{ fontSize: '13px' }}>🎯 進む方向:</strong>
                                                                            <select value={p.correctClock || 12} onChange={(e) => updatePoint(i, 'correctClock', Number(e.target.value))} style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}>
                                                                                {(p.clockPositions || []).length === 0 && <option value={12}>道を選択してください</option>}
                                                                                {(p.clockPositions || []).map(h => <option key={h} value={h}>{h}時へ進む</option>)}
                                                                            </select>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <input type="text" value={p.customNote || ''} onChange={(e) => updatePoint(i, 'customNote', e.target.value)} placeholder="AIへの補足（例: 中央に丸い花壇がある）" style={{ width: '100%', padding: '6px', marginTop: '8px', fontSize: '12px', borderRadius: '4px', border: '1px solid #ccc' }} />
                                                            </div>

                                                            <textarea value={p.svgCode || ''} onChange={(e) => updatePoint(i, 'svgCode', e.target.value)} placeholder="AIが生成したSVGコード（<svg>...</svg>）をここに貼り付け" style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', height: '60px', fontFamily: 'monospace', fontSize: '12px' }} />
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