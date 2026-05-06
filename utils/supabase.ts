// utils/supabase.ts
import { createClient } from '@supabase/supabase-js';

// .env.local に設定した環境変数を読み込む
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Supabaseクライアントを作成してエクスポート（他のファイルで使えるようにする）
export const supabase = createClient(supabaseUrl, supabaseAnonKey);