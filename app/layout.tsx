// app/layout.tsx
export const metadata = {
    title: 'コマ地図ウォークラリー',
    description: '地図上に経路を作成するアプリ',
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <html lang="ja">
            <body>
                {/* この children の部分に、page.tsx の中身が自動的にはめ込まれます */}
                {children}
            </body>
        </html>
    )
}