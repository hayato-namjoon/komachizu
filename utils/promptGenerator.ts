// utils/promptGenerator.ts

export type Point = {
    lat: number; lng: number; instruction: string; direction: string; svgCode?: string;
    intersectionShape?: string;
    clockPositions?: number[];
    correctClock?: number;
    customNote?: string;
    pointType?: string;
};

function getBearing(lat1: number, lng1: number, lat2: number, lng2: number): string {
    const dy = lat2 - lat1; const dx = lng2 - lng1;
    let theta = Math.atan2(dx, dy) * (180 / Math.PI);
    if (theta < 0) theta += 360;
    const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西', '北'];
    return directions[Math.round(theta / 45)];
}

function getShapePrompt(point: Point): string {
    const shape = point.intersectionShape || '十字路';
    const dirEmoji = point.direction.split(' ')[0];

    if (shape === 'その他（詳細設定）') {
        const roads = point.clockPositions || [12];
        const correct = point.correctClock || roads[0];
        return `中心(50,50)から ${roads.join('時、')}時、6時 の方向に黒い道を引いてください。そして、${correct}時の方向へ向かって赤い矢印を描いてください。`;
    }

    let targetClock = 12;
    if (dirEmoji === '➡️') targetClock = 3;
    if (dirEmoji === '⬅️') targetClock = 9;
    if (dirEmoji === '↗️') targetClock = 2;
    if (dirEmoji === '↖️') targetClock = 10;
    if (dirEmoji === '↪️') targetClock = 6;

    switch (shape) {
        case '十字路': return `中心(50,50)から 12時、3時、6時、9時 の4方向に黒い道を引いてください。そして、${targetClock}時の方向へ向かって赤い矢印を描いてください。`;
        case 'Y字路':
            const yClock = (dirEmoji === '➡️' || dirEmoji === '↗️') ? 2 : ((dirEmoji === '⬅️' || dirEmoji === '↖️') ? 10 : targetClock);
            return `中心(50,50)から 10時、2時、6時 の3方向に黒い道を引いてください。そして、${yClock}時の方向へ向かって赤い矢印を描いてください。`;
        case 'T字路（突き当たり）': return `中心(50,50)から 9時、3時、6時 の3方向に黒い道を引いてください（12時には道なし）。そして、${targetClock}時の方向へ向かって赤い矢印を描いてください。`;
        case 'ト字路（右分岐）': return `中心(50,50)から 12時、3時、6時 の3方向に黒い道を引いてください（9時には道なし）。そして、${targetClock}時の方向へ向かって赤い矢印を描いてください。`;
        case '逆ト字路（左分岐）': return `中心(50,50)から 12時、9時、6時 の3方向に黒い道を引いてください（3時には道なし）。そして、${targetClock}時の方向へ向かって赤い矢印を描いてください。`;
        default: return `中心(50,50)から 12時と6時 の2方向へ道を引いてください。そして、${targetClock}時の方向へ赤い矢印を描いてください。`;
    }
}

export function generateAIPrompt(courseTitle: string, points: Point[]): string {
    const basePrompt = `あなたはプロのオリエンテーリング地図製作者です。
ウォークラリーアプリで使用する「コマ地図（交差点の略図）」をSVGコードで出力してください。

【絶対遵守の描画ルール】
1. viewBoxは "0 0 100 100" 固定。交差点の中心点は必ず (50, 50) とすること。
2. 進入してくる道は、必ず画面下端 (50, 100) から中心 (50, 50) に向かう太い黒線で描くこと（これが6時の方向です）。
3. 指定された指示に従って「ハズレの道」も含めたすべての道を黒線で描くこと。
4. 進むべき正しい退出方向に対してのみ、赤色で目立つ矢印を中心から描画すること。
5. 背景は透過（transparent）とすること。
6. 【超重要】各ポイントのSVGコードのみを順番に連続して出力してください。AIの挨拶、説明文、ポイント番号（例: "<!-- ポイント 1 -->"）などはアプリのエラーに繋がるため一切不要です。純粋な <svg>〜</svg> のブロックのみを返してください。

以下が各ポイントのデータです。
`;

    let pointsText = '';

    points.forEach((point, index) => {
        if (point.pointType === 'ゴール' || index === points.length - 1) return;

        const enterDirection = index === 0 ? '南' : getBearing(points[index - 1].lat, points[index - 1].lng, point.lat, point.lng);
        const exitDirection = getBearing(point.lat, point.lng, points[index + 1].lat, points[index + 1].lng);
        const shapePrompt = getShapePrompt(point);
        const notePrompt = point.customNote ? `\n・【AIへの特別補足】: ${point.customNote}` : '';
        const pType = point.pointType || 'ただの道順';

        pointsText += `
---
【ポイント ${index + 1} のコマ地図】（種類: ${pType}）
・交差点の形状と正解ルート: ${shapePrompt}
・管理者の補足: ${point.instruction || 'なし'}${notePrompt}
（※参考: 現実では ${enterDirection}から進入し、${exitDirection}へ退出しますが、SVG内では必ず進入方向を画面下=6時として描画してください）
`;
    });

    return basePrompt + pointsText;
}