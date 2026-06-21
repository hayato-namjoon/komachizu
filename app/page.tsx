// app/page.tsx
'use client';

import Link from 'next/link';

export default function TopPage() {
    return (
        <div className="top-page-container">
            {/* 独自の世界観を表現するCSSスタイル */}
            <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Zen+Kurenaido&display=swap');
        
        * { box-sizing: border-box; }
        
        .top-page-container {
          padding: 40px 20px;
          max-width: 600px;
          margin: 0 auto;
          font-family: "Zen Kurenaido", sans-serif;
          background-color: #fdf6e3;
          min-height: 100vh;
          color: #5c3a21;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .header-area {
          text-align: center;
          margin-bottom: 50px;
        }

        .main-title {
          font-size: 36px;
          margin: 0 0 10px 0;
          font-weight: bold;
          letter-spacing: 2px;
        }

        .sub-title {
          font-size: 16px;
          margin: 0;
          opacity: 0.8;
          border-bottom: 2px dashed #8b5a2b;
          padding-bottom: 15px;
          display: inline-block;
          width: 100%;
        }

        .menu-area {
          display: flex;
          flex-direction: column;
          gap: 25px;
          width: 100%;
        }

        .menu-card {
          display: block;
          text-decoration: none;
          background-color: #fbf4e6;
          border: 2px solid #8b5a2b;
          border-radius: 8px;
          padding: 25px;
          color: #5c3a21;
          box-shadow: 3px 3px 0px #8b5a2b;
          transition: transform 0.2s, box-shadow 0.2s;
          cursor: pointer;
        }

        .menu-card:hover {
          transform: translate(-2px, -2px);
          box-shadow: 5px 5px 0px #8b5a2b;
        }

        .menu-card:active {
          transform: translate(2px, 2px);
          box-shadow: 1px 1px 0px #8b5a2b;
        }

        .card-title {
          font-size: 22px;
          font-weight: bold;
          margin: 0 0 8px 0;
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .card-desc {
          font-size: 14px;
          margin: 0;
          line-height: 1.6;
          opacity: 0.9;
        }

        .footer {
          margin-top: 60px;
          font-size: 12px;
          opacity: 0.6;
        }

        /* スマートフォン向け（画面幅 480px 以下）の調整 */
        @media (max-width: 480px) {
          .main-title { font-size: 28px; }
          .card-title { font-size: 20px; }
          .menu-card { padding: 20px; }
        }
      `}</style>

            {/* ヘッダーエリア */}
            <div className="header-area">
                <h1 className="main-title">🧭 コマ地図ウォークラリー</h1>
                <p className="sub-title">〜 街を歩く、目印を探す、冒険に出る 〜</p>
            </div>

            {/* メニュー選択エリア */}
            <div className="menu-area">

                {/* 1. プレイヤー画面 (Play) へのリンク */}
                <Link href="/play" className="menu-card">
                    <h2 className="card-title">🚶‍♂️ 冒険を始める (Play)</h2>
                    <p className="card-desc">
                        作成されたウォークラリーコースに挑戦します。スマートフォンのGPS機能と連動し、手元のコマ地図を頼りに隠されたチェックポイントの解放やゴールを目指して街を探索しましょう。
                    </p>
                </Link>

                {/* 2. コース作成画面 (Create) へのリンク */}
                <Link href="/create" className="menu-card" style={{ borderColor: '#722ed1', boxShadow: '3px 3px 0px #722ed1' }}>
                    <h2 className="card-title" style={{ color: '#531dab' }}>📚 コースを作る (Create)</h2>
                    <p className="card-desc" style={{ color: '#531dab' }}>
                        【管理者用機能】新しいウォークラリーのコースを設計します。地図上にピンを配置し、ストリートビューで現地の目印を確認しながら、AIと連携して本格的なコマ地図を一括生成します。
                    </p>
                </Link>

            </div>

            {/* フッター */}
            <div className="footer">
                © コマ地図ウォークラリー冒険日誌
            </div>
        </div>
    );
}
