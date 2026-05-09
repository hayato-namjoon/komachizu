// utils/promptGenerator.ts

// 🌟 型に新しいプロパティを追加
export type Point = {
    lat: number; lng: number; instruction: string; direction: string; svgCode?: string;
    intersectionShape?: string; // 交差点の形状（十字路、Y字路など）
    clockPositions?: number[];  // その他を選んだ場合の、道が存在する方角（例: [10, 2]）
    correctClock?: number;      // その他を選んだ場合の、正解の方角（例: 2）
    customNote?: string;        // AIへの補足指示
};

function getBearing(lat1: number, lng1: number, lat2: number, lng2: number): string {
    const dy = lat2 - lat1; const dx = lng2 - lng1;
    let theta = Math.atan2(dx, dy) * (180 / Math.PI);
    if (theta < 0) theta += 360;
    const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西', '北'];
    return directions[Math.round(theta / 45)];
}

// 🌟 交差点の形を、AIがわかる「時計の指示」に変換する関数
function getShapePrompt(point: Point): string {
    const shape = point.intersectionShape || '十字路';

    if (shape === 'その他（詳細設定）') {
        const roads = point.clockPositions || [12];
        const correct = point.correctClock || roads[0];
        return `中心(50,50)から ${roads.join('時、')}時、6時 の方向に黒い道を引いてください。そして、${correct}時の方向へ向かって赤い矢印を描いてください。`;
    }

    switch (shape) {
        case '十字路': return '中心(50,50)から 12時、3時、6時、9時 の4方向に黒い道を引いてください（完全な十字）。';
        case 'Y字路': return '中心(50,50)から 10時、2時、6時 の3方向に黒い道を引いてください（左右対称のY字）。';
        case 'T字路（突き当たり）': return '中心(50,50)から 9時、3時、6時 の3方向に黒い道を引いてください（12時の方向には道がありません）。';
        case 'ト字路（右分岐）': return '中心(50,50)から 12時、3時、6時 の3方向に黒い道を引いてください（9時の方向には道がありません）。';
        case '逆ト字路（左分岐）': return '中心(50,50)から 12時、9時、6時 の3方向に黒い道を引いてください（3時の方向には道がありません）。';
        default: return '中心(50,50)から 12時と6時 の2方向へ黒い直線を引いてください（一本道）。';
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
5. 背景は透過（transparent）とし、余計な説明文は省きSVGコードのみを出力すること。

以下が各ポイントのデータです。
`;

    let pointsText = '';

    points.forEach((point, index) => {
        if (index === points.length - 1) return; // ゴールはスキップ

        const enterDirection = index === 0 ? '南' : getBearing(points[index - 1].lat, points[index - 1].lng, point.lat, point.lng);
        const exitDirection = getBearing(point.lat, point.lng, points[index + 1].lat, points[index + 1].lng);
        const shapePrompt = getShapePrompt(point);
        const notePrompt = point.customNote ? `\n・【AIへの特別補足】: ${point.customNote}` : '';

        pointsText += `
---
【ポイント ${index + 1} のコマ地図】
・交差点の形状と正解ルート: ${shapePrompt}
・管理者の指示用テキスト: ${point.direction.split(' ')[0]} ${point.instruction || '指示なし'}${notePrompt}
（※参考: 現実のマップ上では ${enterDirection}から進入し、${exitDirection}へ退出します。ただしSVG内では必ず進入方向を画面下=6時として描画してください）
`;
    });

    return basePrompt + pointsText;
}