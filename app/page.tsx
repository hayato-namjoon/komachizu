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

    // 🌟 追加：一括貼り付け用のテキストエリア状態
    const [bulkSvgInput, setBulkSvgInput] = useState('');

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
            const res = await fetch(`[https://nominatim.openstreetmap.org/search?format=json&q=$](https://nominatim.openstreetmap.org/search?format=json&q=$){encodeURIComponent(searchQuery)}`);
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
        setPoints([...points, {
            lat, lng, instruction: '', direction: '⬆️ 直進', svgCode: '',
            intersectionShape: '十字路', clockPositions: [12], correctClock: 12,
            customNote: '', pointType: initialType,
            radius: 20 // 🌟 追加：デフォルトは安全な20mにしておく
        }]);
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

    const saveCourse = async () => {
        if (!title || points.length === 0) return alert('コース名とピンの配置が必要です！');
        const existingCourse = courses.find(c => c.title === title && c.id !== editingId);
        let targetId = editingId;

        if (existingCourse) {
            const confirmOverwrite = confirm(`「${title}」という名前のコースは既に存在します。\n上書き保存してもよろしいですか？`);
            if (!confirmOverwrite) return;
            targetId = existingCourse.id;
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
            if (targetId && targetId !== editingId) setEditingId(targetId);
        } catch (error) {
            alert('保存に失敗しました。');
        } finally {
            setIsSaving(false);
        }
    };

    const deleteCourse = async () => {
        if (!editingId) return;
        const confirmDelete = confirm(`本当にコース「${title}」を削除しますか？\nこの操作は取り消せません。`);
        if (!confirmDelete) return;

        try {
            await supabase.from('courses').delete().eq('id', editingId);
            alert('🗑️ コースを削除しました。');
            setEditingId(null); setTitle(''); setPoints([]); fetchCourses();
        } catch (error) { alert('削除に失敗しました。'); }
    };

    const handleCopyPrompt = () => {
        if (!title || points.length < 2) return alert('コース名を入力し、ピンを2つ以上打ってください。');
        const promptText = generateAIPrompt(title, points);
        navigator.clipboard.writeText(promptText).then(() => alert('🤖 プロンプトをコピーしました！AIに貼り付けてください。'));
    };

    // 🌟 追加：SVGの一括反映ロジック
    const handleApplyBulkSvg = () => {
        if (!bulkSvgInput.trim()) return alert('AIの回答が貼り付けられていません！');

        // <svg>から</svg>までを正規表現で全て抽出する（改行も含める）
        const svgRegex = /<svg[\s\S]*?<\/svg>/gi;
        const matches = bulkSvgInput.match(svgRegex);

        if (!matches || matches.length === 0) {
            return alert('貼り付けられたテキストの中に、有効なSVGコード（<svg>〜</svg>）が見つかりませんでした。');
        }

        let matchIndex = 0;
        const newPoints = points.map(p => {
            // ゴール以外のポイントに順番に抽出したSVGを割り当てる
            if (p.pointType !== 'ゴール' && matchIndex < matches.length) {
                const svgCode = matches[matchIndex];
                matchIndex++;
                return { ...p, svgCode };
            }
            return p;
        });

        setPoints(newPoints);
        setBulkSvgInput(''); // 入力欄をクリア
        alert(`✨ ${matchIndex}個のSVGデータを各ポイントに自動で振り分けました！`);
    };

    const getHeaderColor = (type?: string) => {
        if (type === 'スタート地点') return '#1890ff';
        if (type === 'ゴール') return '#ff4d4f';
        if (type === 'チェックポイント') return '#faad14';
        return '#333';
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
                            <li><strong>各地点の「状態」を選ぶ：</strong> スタート、ただの道順、チェックポイント、ゴールをプルダウンから設定します。</li>
                            <li><strong>交差点の形状を設定する：</strong> 右側のリストから、交差点の形を選びます。</li>
                            <li><strong>AI用プロンプトを生成：</strong> 「🤖 1. AI用プロンプトコピー」ボタンを押します。</li>
                            <li><strong>AIに画像を描かせる：</strong> ChatGPT等に貼り付けます。</li>
                            <li><strong>SVGを一括反映する：</strong> 出力された回答をそのまま紫色のテキストエリアに貼り付け、「✨ 3. 一括自動振り分け」ボタンを押します。</li>
                            <li><strong>保存する：</strong> コース名をつけて保存します。</li>
                        </ol>
                    </div>
                )}
            </div>

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', padding: '15px', backgroundColor: '#f0f2f5', borderRadius: '8px', alignItems: 'center' }}>
                <select value={editingId || ''} onChange={handleLoadCourse} style={{ flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}>
                    <option value="">＋ 新規コース作成</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                {editingId && (
                    <button onClick={deleteCourse} style={{ padding: '8px 16px', backgroundColor: '#ff4d4f', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>🗑️ 削除</button>
                )}
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="コース名" style={{ flex: '2', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }} />
                <button onClick={saveCourse} disabled={isSaving} style={{ padding: '8px 24px', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {isSaving ? '⏳ 保存中...' : '💾 保存'}
                </button>
            </div>


            <div style={{ marginBottom: '20px', padding: '20px', backgroundColor: '#f9f0ff', border: '2px solid #d3adf7', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <h3 style={{ margin: 0, color: '#531dab', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🤖 AI連携エリア（コマ地図画像の一括生成）
                    </h3>
                    <div>
                        <button onClick={handleUndo} disabled={points.length === 0} style={{ marginRight: '10px', padding: '8px 16px', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' }}>↩️ 戻す</button>
                        <button onClick={handleClear} disabled={points.length === 0} style={{ padding: '8px 16px', color: 'red', cursor: 'pointer', borderRadius: '4px', border: '1px solid #ffccc7', backgroundColor: '#fff2f0' }}>🗑️ クリア</button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <button onClick={handleCopyPrompt} style={{ padding: '12px', backgroundColor: '#722ed1', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        1. 📋 AI用プロンプトをコピーする
                    </button>

                    <textarea
                        value={bulkSvgInput}
                        onChange={(e) => setBulkSvgInput(e.target.value)}
                        placeholder="2. ChatGPT等が出力した回答（複数のSVGコードが含まれたテキスト）を、ここにまるごと貼り付けてください。"
                        style={{ width: '100%', height: '100px', padding: '12px', borderRadius: '6px', border: '1px solid #d3adf7', fontFamily: 'monospace', fontSize: '14px', resize: 'vertical' }}
                    />

                    <button onClick={handleApplyBulkSvg} style={{ padding: '12px', backgroundColor: '#eb2f96', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '16px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                        3. ✨ コピーしたSVGを各ポイントに一括流し込み！
                    </button>
                </div>
            </div>

            <div style={{ display: 'flex', gap: '20px' }}>
                <div style={{ flex: '1', border: '2px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ padding: '10px', backgroundColor: '#e6f7ff', borderBottom: '1px solid #91d5ff', display: 'flex', gap: '10px' }}>
                        <strong style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>🔍 地図を移動:</strong>
                        <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation()} placeholder="都道府県、市区町村、または郵便番号" style={{ flex: '1', padding: '8px', borderRadius: '4px', border: '1px solid #91d5ff' }} />
                        <button onClick={handleSearchLocation} style={{ padding: '8px 16px', backgroundColor: '#1890ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>ジャンプ</button>
                    </div>
                    <Map center={mapCenter} onMapClick={handleMapClick} points={points} />
                </div>

                <div style={{ width: '450px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9', maxHeight: '700px', overflowY: 'auto' }}>
                    <h3 style={{ marginTop: 0 }}>📍 チェックポイント一覧</h3>
                    {isBrowser && (
                        <DragDropContext onDragEnd={onDragEnd}>
                            <Droppable droppableId="point-list">
                                {(provided) => (
                                    <div {...provided.droppableProps} ref={provided.innerRef} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                                        {points.map((p, i) => {
                                            const currentAllowedDirections = VALID_DIRECTIONS[p.intersectionShape || '十字路'] || VALID_DIRECTIONS['その他（詳細設定）'];

                                            return (
                                                <Draggable draggableId={`point-${i}`} index={i} key={`point-${i}`}>
                                                    {(provided, snapshot) => (
                                                        <div ref={provided.innerRef} {...provided.draggableProps} style={{ padding: '15px', backgroundColor: snapshot.isDragging ? '#e6f7ff' : '#fff', border: '1px solid #ddd', borderRadius: '8px', ...provided.draggableProps.style }}>

                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                                                                <div {...provided.dragHandleProps} style={{ cursor: 'grab', fontWeight: 'bold', color: getHeaderColor(p.pointType) }}>
                                                                    ≡ ポイント {i + 1} {p.pointType ? `(${p.pointType})` : ''}
                                                                </div>
                                                                <button onClick={() => removePoint(i)} style={{ color: 'red', border: 'none', background: 'none', cursor: 'pointer' }}>❌</button>
                                                            </div>

                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', padding: '8px', backgroundColor: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '6px' }}>
                                                                <strong style={{ whiteSpace: 'nowrap', color: '#52c41a' }}>🚩 役割:</strong>
                                                                <select
                                                                    value={p.pointType || 'ただの道順'}
                                                                    onChange={(e) => updatePoint(i, 'pointType', e.target.value)}
                                                                    style={{ padding: '6px', flex: 1, borderRadius: '4px', border: '1px solid #ccc', fontWeight: 'bold' }}
                                                                >
                                                                    {POINT_TYPES.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                                                </select>
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

                                                            {/* 🌟 追加：到達判定エリアの選択 */}
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px', padding: '8px', backgroundColor: '#e6fffb', border: '1px solid #87e8de', borderRadius: '6px' }}>
                                                                <strong style={{ whiteSpace: 'nowrap', color: '#13c2c2' }}>🎯 到達判定:</strong>
                                                                <select
                                                                    value={p.radius || 20}
                                                                    onChange={(e) => updatePoint(i, 'radius', Number(e.target.value))}
                                                                    style={{ padding: '6px', flex: 1, borderRadius: '4px', border: '1px solid #ccc', fontWeight: 'bold' }}
                                                                >
                                                                    <option value={1}>1m (1m)</option>
                                                                    <option value={5}>5m (5m)</option>
                                                                    <option value={10}>10m (10m)</option>
                                                                    <option value={20}>20m (20m)</option>
                                                                </select>
                                                                <span style={{ fontSize: '11px', color: '#666' }}>※スマホのGPS誤差を考慮してください</span>
                                                            </div>

                                                            <textarea value={p.svgCode || ''} onChange={(e) => updatePoint(i, 'svgCode', e.target.value)} placeholder="※一括流し込みで自動入力されます" style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px', height: '60px', fontFamily: 'monospace', fontSize: '12px' }} />
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