// utils/promptGenerator.ts

type Point = { lat: number; lng: number; instruction: string; direction: string };

// 🌟 2つの座標から方角（北、北東など8方位）を計算する関数
function getBearing(lat1: number, lng1: number, lat2: number, lng2: number): string {
    const dy = lat2 - lat1;
    const dx = lng2 - lng1;
    // 角度を計算（北を0度として時計回り）
    let theta = Math.atan2(dx, dy) * (180 / Math.PI);
    if (theta < 0) theta += 360;

    const directions = ['北', '北東', '東', '南東', '南', '南西', '西', '北西', '北'];
    const index = Math.round(theta / 45);
    return directions[index];
}

// 🌟 AIに渡すプロンプトを組み立てる関数
export function generateAIPrompt(courseTitle: string, points: Point[]): string {
    // 📝 ここがAIへの「全体への指示（システムプロンプト）」です。後から自由に変更してください。
    const basePrompt = `
あなたはプロのオリエンテーリング地図製作者です。
ウォークラリーアプリ「${courseTitle}」で使用する「コマ地図（交差点の略図）」を、ポイントごとにSVGコードで出力してください。

【描画のルール】
・各画像は、進行方向（進入してくる道）が「画面の下」になる視点で描画してください。
・道全体を「黒い太線」で描いてください。
・進むべき正しい方向を「赤い矢印」で強調して描いてください。
・背景は透過（transparent）にしてください。
・余計な説明文は省き、SVGコードのみを出力してください。

以下が各ポイントの交差点の形状と、方角のデータです。
`;

    // 📝 各ポイントの情報を組み立てる部分です。
    let pointsText = '';

    points.forEach((point, index) => {
        // 最初のポイントと最後のポイント（ゴール）はコマ図が不要な場合が多いためスキップするか判定
        if (index === points.length - 1) return; // ゴールはスキップ

        // どこから来たか（前のポイントから今の方角）※最初の場合は南から来たことにする
        const enterDirection = index === 0
            ? '南'
            : getBearing(points[index - 1].lat, points[index - 1].lng, point.lat, point.lng);

        // どこへ向かうか（今のポイントから次の方角）
        const exitDirection = getBearing(point.lat, point.lng, points[index + 1].lat, points[index + 1].lng);

        pointsText += `
---
【ポイント ${index + 1} のコマ地図】
・管理者の指示： ${point.direction.split(' ')[0]} ${point.instruction || '指示なし'}
・現実の進入方角： ${enterDirection}から交差点へ進入（これを画面下として描画）
・現実の退出方角： ${exitDirection}へ向かって退出
`;
    });

    return basePrompt + pointsText;
}