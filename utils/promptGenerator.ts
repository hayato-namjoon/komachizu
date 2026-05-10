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
    // 🌟 追加：到達判定の半径（m）
    radius?: number;
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
    const style = point.roadStyle || 'normal';
    const noEntries = point.noEntryClocks || [];

    let targetClock = 12;
    if (dirEmoji === '➡️') targetClock = 3;
    if (dirEmoji === '⬅️') targetClock = 9;
    if (dirEmoji === '↗️') targetClock = 2;
    if (dirEmoji === '↖️') targetClock = 10;
    if (dirEmoji === '↪️') targetClock = 6;

    // 🌟 道の形の指示
    let styleInstruction = '黒い太線（直線）で描いてください。';
    if (style === 'curve') styleInstruction = '滑らかな曲線（ベジェ曲線）で描いてください。';
    if (style === 'zigzag') styleInstruction = 'ギザギザの折れ線（ジグザグ）で描いてください。';

    // 🌟 進入禁止の指示
    const noEntryInstruction = noEntries.length > 0
        ? `また、${noEntries.join('時、')}時の方向の道の入り口には、進入禁止を示す太い横棒（道路を塞ぐような短い線）を描いてください。`
        : '';

    if (shape === 'その他（詳細設定）') {
        const roads = point.clockPositions || [12];
        const correct = point.correctClock || roads[0];
        const arrowInst = correct === 6
            ? '中心付近でぐるっとUターンして6時の方向へ戻る赤い矢印を描いてください。'
            : `${correct}時の方向へ向かって赤い矢印を描いてください。`;
        return `中心(50,50)から ${roads.join('時、')}時、6時 の方向に道を、${styleInstruction}${noEntryInstruction}${arrowInst}`;
    }

    const arrowInstruction = targetClock === 6
        ? '中心付近でぐるっとUターンして6時の方向へ戻る赤い矢印を描いてください。'
        : `${targetClock}時の方向へ向かって赤い矢印を描いてください。`;

    const baseLine = (clocks: string, noGo: string) =>
        `中心(50,50)から ${clocks} の方向に道を、${styleInstruction}${noGo}${arrowInstruction}`;

    switch (shape) {
        case '十字路': return baseLine('12時、3時、6時、9時', noEntryInstruction);
        case 'Y字路':
            const yClock = (dirEmoji === '➡️' || dirEmoji === '↗️') ? 2 : ((dirEmoji === '⬅️' || dirEmoji === '↖️') ? 10 : targetClock);
            return `中心(50,50)から 10時、2時、6時 の方向に道を、${styleInstruction}${noEntryInstruction}${yClock}時の方向へ赤い矢印を描いてください。`;
        case 'T字路（突き当たり）': return baseLine('9時、3時、6時', noEntryInstruction);
        case 'ト字路（右分岐）': return baseLine('12時、3時、6時', noEntryInstruction);
        case '逆ト字路（左分岐）': return baseLine('12時、9時、6時', noEntryInstruction);
        default: return baseLine('12時と6時', noEntryInstruction);
    }
}

export function generateAIPrompt(courseTitle: string, points: Point[]): string {
    const basePrompt = `あなたはプロのオリエンテーリング地図製作者です。
ウォークラリーアプリで使用する「コマ地図（交差点の略図）」をSVGコードで出力してください。

【絶対遵守の描画ルール】
1. viewBoxは "0 0 100 100" 固定。中心点は (50, 50) とすること。
2. 進入路は画面下端 (50, 100) から中心 (50, 50) に向かう太い黒線で描くこと（6時の方向）。
3. 指定された形状（曲線、ギザギザ、直線）を忠実に再現して描画すること。
4. 正しい進行方向には赤色で目立つ矢印を描くこと。
5. 背景は透過。
6. 【超重要】SVGコードのみを順番に出力してください。説明文は一切不要です。

以下が各ポイントのデータです。
`;

    let pointsText = '';
    points.forEach((point, index) => {
        if (point.pointType === 'ゴール' || index === points.length - 1) return;
        const shapePrompt = getShapePrompt(point);
        const notePrompt = point.customNote ? `\n・【AIへの補足】: ${point.customNote}` : '';

        pointsText += `
---
【ポイント ${index + 1}】
・形状と指示: ${shapePrompt}${notePrompt}
`;
    });

    return basePrompt + pointsText;
}