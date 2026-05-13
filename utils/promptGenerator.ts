// utils/promptGenerator.ts

export type Point = {
    lat: number; lng: number; instruction: string; direction: string; svgCode?: string;
    intersectionShape?: string;
    clockPositions?: number[];
    correctClock?: number;
    customNote?: string;
    pointType?: string;
    roadStyle?: 'normal' | 'curve' | 'zigzag';
    noEntryClocks?: number[];
    radius?: number;
    landmark?: string;
};

function getBearing(lat1: number, lng1: number, lat2: number, lng2: number): string {
    const dy = lat2 - lat1; const dx = lng2 - lng1;
    let theta = Math.atan2(dx, dy) * (180 / Math.PI);
    if (theta < 0) theta += 360;
    const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西', '北'];
    return directions[Math.round(theta / 45)];
}

function getShapePrompt(point: Point, isStart: boolean): string {
    const shape = point.intersectionShape || '十字路';
    const dirEmoji = point.direction.split(' ')[0];
    const style = point.roadStyle || 'normal';
    const noEntries = point.noEntryClocks || [];

    let targetClock = 12;
    if (dirEmoji === '➡️') targetClock = 3;
    if (dirEmoji === '⬅️') targetClock = 9;
    if (dirEmoji === '↗️') targetClock = 2;
    if (dirEmoji === '↖️') targetClock = 10;
    if (dirEmoji === '↪️') targetClock = 6;

    let styleInstruction = '黒い太線（直線）で描いてください。';
    if (style === 'curve') styleInstruction = '滑らかな曲線（ベジェ曲線）で描いてください。';
    if (style === 'zigzag') styleInstruction = 'ギザギザの折れ線（ジグザグ）で描いてください。';

    const noEntryInstruction = noEntries.length > 0
        ? `また、${noEntries.join('時、')}時の方向の道の入り口には、進入禁止を示す太い横棒（道路を塞ぐ短い線）を描いてください。`
        : '';

    // 🌟 先ほどの「手前・奥」の矢印分岐をここに組み込むことも可能です（必要に応じてカスタマイズしてください）
    const arrowInstruction = targetClock === 6
        ? '中心付近でぐるっとUターンして6時の方向へ戻る「U字型の赤い矢印」を描いてください。'
        : `${targetClock}時の方向へ向かって赤い矢印を描いてください。`;

    const formatClocks = (clocksStr: string) => {
        if (!isStart) return clocksStr;
        return clocksStr.split('、').filter(c => c !== '6時').join('、') || '（道なし）';
    };

    if (shape === 'その他（詳細設定）') {
        let roads = point.clockPositions || [12];
        if (!isStart && !roads.includes(6)) roads = [...roads, 6].sort((a, b) => a - b);
        if (isStart) roads = roads.filter(r => r !== 6);

        const correct = point.correctClock || roads[0];
        const customArrow = correct === 6
            ? '中心付近でぐるっとUターンして6時の方向へ戻るU字型の赤い矢印を描いてください。'
            : `${correct}時の方向へ向かって赤い矢印を描いてください。`;
        return `中心(50,50)から ${roads.join('時、')}時 の方向に道を、${styleInstruction}${noEntryInstruction}${customArrow}`;
    }

    const baseLine = (clocks: string, noGo: string) =>
        `中心(50,50)から ${formatClocks(clocks)} の方向に道を、${styleInstruction}${noGo}${arrowInstruction}`;

    switch (shape) {
        case '十字路': return baseLine('12時、3時、6時、9時', noEntryInstruction);
        case 'Y字路':
            const yClock = (dirEmoji === '➡️' || dirEmoji === '↗️') ? 2 : ((dirEmoji === '⬅️' || dirEmoji === '↖️') ? 10 : targetClock);
            const yArrow = targetClock === 6 ? '中心付近でぐるっとUターンして6時の方向へ戻るU字型の赤い矢印を描いてください。' : `${yClock}時の方向へ向かって赤い矢印を描いてください。`;
            return `中心(50,50)から ${formatClocks('10時、2時、6時')} の方向に道を、${styleInstruction}${noEntryInstruction}${yArrow}`;
        case 'T字路（突き当たり）': return baseLine('9時、3時、6時', noEntryInstruction);
        case 'ト字路（右分岐）': return baseLine('12時、3時、6時', noEntryInstruction);
        case '逆ト字路（左分岐）': return baseLine('12時、9時、6時', noEntryInstruction);
        default: return baseLine('12時、6時', noEntryInstruction);
    }
}

export function generateAIPrompt(courseTitle: string, points: Point[]): string {
    const basePrompt = `あなたはプロのオリエンテーリング地図製作者です。
ウォークラリーアプリで使用する「コマ地図（交差点の略図）」をSVGコードで出力してください。

【絶対遵守の描画ルール】
1. viewBoxは "0 0 100 100" 固定。中心点は (50, 50) とすること。
2. 進入路は画面下端 (50, 100) から中心 (50, 50) に向かう太い黒線で描くこと（これが6時の方向です）。※ただし種類が「スタート地点」の場合は、進入路（6時の道）は描かないでください。
3. 指定された形状（曲線、ギザギザ、直線）を忠実に再現して描画すること。
4. 正しい進行方向には赤色で目立つ矢印を描くこと。
5. 背景は透過。
6. 【超重要】SVGコードのみをまとめて出力してください。挨拶や説明文は一切不要です。
7. 🌟 【目印の描画】「目印」の指定がある場合、交差点の該当する位置に以下の【公式デザインルール】に沿ってアイコンを描き込んでください。

【公式デザインルール（統一規格）】
・信号機：黒い長方形の中に、青(緑)・黄・赤の3つの小さな丸を並べる。
・横断歩道：道路を縦断する白い縞模様、白い縞模様の本数を5本とする。
・電灯/外灯：黄色の丸（背景に同化しないよう、必ず stroke="black" stroke-width="2" の太い黒縁をつける）。
・ポスト：濃いオレンジ色（または赤）の四角形に、白い横線（投函口）を入れる。
・橋：道路の両脇に、欄干を示す茶色またはグレーの太線を引く。
・案内板/看板：青または緑の四角形。
・建物/お店：特定の色の四角形（コンビニなら青や緑など、適宜判断）。
※上記以外の目印の場合も、シンプルで幾何学的な図形（丸、四角、三角）と分かりやすい色を使って表現してください。
※進行方向を示す「赤い矢印」と混同しないように配置や色に注意してください。

以下が各ポイントのデータです。
`;

    let pointsText = '';
    points.forEach((point, index) => {
        if (point.pointType === 'ゴール' || index === points.length - 1) return;

        const isStart = point.pointType === 'スタート地点';
        const shapePrompt = getShapePrompt(point, isStart);
        const landmarkPrompt = point.landmark ? `\n・目印: ${point.landmark}` : '';
        const notePrompt = point.customNote ? `\n・【AIへの補足】: ${point.customNote}` : '';

        pointsText += `
---
【ポイント ${index + 1}】（種類: ${point.pointType || 'ただの道順'}）
・形状と指示: ${shapePrompt}${landmarkPrompt}${notePrompt}
`;
    });

    return basePrompt + pointsText;
}