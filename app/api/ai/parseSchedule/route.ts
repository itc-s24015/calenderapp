import { NextResponse } from "next/server";

// OpenAI API (GPT-4/5) を想定
import OpenAI from "openai";

// 環境変数に設定しておく
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { text } = body;

    if (!text) {
      return NextResponse.json({ success: false, error: "text が必要です" });
    }

    // AI にパースさせる
    const prompt = `
あなたはカレンダーアシスタントです。
ユーザーの入力を JSON に変換してください。
JSON のフォーマットは以下の通りです：
{
  "title": "予定のタイトル",
  "date": "YYYY-MM-DD",
  "startTime": "HH:MM",
  "endTime": "HH:MM",
  "color": "#任意のカラーコード",
  "repeat": "none|daily|weekly|monthly",
  "repeatEndDate": "YYYY-MM-DD または null"
}
ユーザーの文章: "${text}"
`;

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
    });

    const message = completion.choices[0].message?.content || "";

    // JSON としてパース
    let schedule;
    try {
      schedule = JSON.parse(message);
    } catch {
      return NextResponse.json({ success: false, error: "AI の解析に失敗しました", raw: message });
    }

    return NextResponse.json({ success: true, data: schedule });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ success: false, error: "APIエラーが発生しました" });
  }
}
