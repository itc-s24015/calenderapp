// app/api/ocr/route.ts

import { NextRequest, NextResponse } from "next/server";
// Anthropic SDK is dynamically imported inside the handler to avoid
// build-time failures on platforms where the package cannot be resolved.
import fs from "fs";
import path from "path";
import os from "os";
import type { OCRResult, APIResponse } from "@/lib/types";

// note: anthropic client will be created dynamically when needed

// Helper: perform OCR using OCR.space (server-friendly) when API key provided
async function performOcrSpace(base64Data: string, mimeType: string) {
  try {
    const apiKey = process.env.OCR_SPACE_API_KEY;
    if (!apiKey) throw new Error("OCR_SPACE_API_KEY not configured");

    const form = new FormData();
    // OCR.space accepts base64 payload prefixed with data:<mime>;base64,
    form.append("apikey", apiKey as string);
    form.append("language", "jpn");
    form.append("isOverlayRequired", "false");
    form.append("filetype", mimeType || "png");
    form.append("base64Image", `data:${mimeType};base64,${base64Data}`);

    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: form as any,
    });

    const json = await res.json();
    if (!json || json.IsErroredOnProcessing) {
      const msg = json?.ErrorMessage || json?.ErrorDetails || "OCR.space error";
      throw new Error(Array.isArray(msg) ? msg.join(";") : String(msg));
    }

    const parsed = json.ParsedResults?.[0]?.ParsedText || "";
    return String(parsed);
  } catch (err) {
    console.error("OCR.space error:", err);
    throw err;
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    data: [],
    info: "OCR endpoint (POST) is available",
  });
}

export async function POST(request: NextRequest) {
  try {
    // Anthropic API キーがない場合は LLM をスキップして Tesseract フォールバックを使います
    const hasAnthropicKey = !!process.env.ANTHROPIC_API_KEY;
    if (!hasAnthropicKey) {
      console.warn(
        "Anthropic API key not configured — will use local Tesseract fallback"
      );
    }

    const formData = await request.formData();
    const image = formData.get("image") as string;

    if (!image) {
      return NextResponse.json<APIResponse<null>>(
        {
          success: false,
          error: "画像がアップロードされていません",
        },
        { status: 400 }
      );
    }

    // Base64からmimeTypeとデータを抽出
    const mimeTypeMatch = image.match(/data:([^;]+);/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : "image/jpeg";
    const base64Data = image.split(",")[1] || image;

    // 名前（フォームで渡された場合）
    const name = (formData.get("name") as string) || "";

    // Claude APIで画像を解析
    // 名前が渡されていれば、その名前に関連するシフトのみ抽出するよう指示を追加します。
    const nameInstruction = name
      ? `\n\n注意: 画像中に氏名や担当者名が記載されている場合は、名前が "${name}" に該当する予定（シフト）のみを抽出してください。該当がない場合は空配列を返してください。`
      : "";

    // より構造化されたJSONを返すようプロンプトを強化します。
    const prompt =
      `この画像からスケジュール・予定情報を抽出してください。\n\n必ず返す形式: JSON配列。配列の各要素は少なくとも title を含むオブジェクトで、可能なら以下フィールドを出力してください: date, startTime, endTime, title, description, category, assignedTo (配列), rawText (文字列)。assignedTo が空でも空配列を返してください。\n\n出力は"JSONのみ"にしてください。余計な説明や注釈、マークダウンは一切含めないでください。日付や時間が読み取れない場合は null を使用し、予定が無ければ空配列 [] を返してください。\n\n以下に複数の具体例を示します。必ず同じフィールド名で返してください。\n\n例1（複数名・日付あり）:\n[\n  {\n    "date": "2025-11-20",\n    "startTime": "09:00",\n    "endTime": "12:00",\n    "title": "会議（営業部）",\n    "description": "来期予算の打ち合わせ",\n    "category": "work",\n    "assignedTo": ["田中 太郎", "佐藤 花子"],\n    "rawText": "11/20 9:00-12:00 田中/佐藤 会議 来期予算"\n  }\n]\n\n例2（氏名が画像に明記され、該当者のみ抽出）:\n[\n  {\n    "date": "2025-11-21",\n    "startTime": "14:00",\n    "endTime": "15:00",\n    "title": "面談",\n    "description": "新人面談",\n    "category": "work",\n    "assignedTo": ["山田 太郎"],\n    "rawText": "11/21 山田 太郎 14:00 面談"\n  }\n]\n\n例3（日時読み取り困難）:\n[\n  {\n    "date": null,\n    "startTime": null,\n    "endTime": null,\n    "title": "納期未定の打ち合わせ",\n    "description": "詳細は未記入",\n    "category": "other",\n    "assignedTo": [],\n    "rawText": "未定 打ち合わせ"\n  }\n]\n\n注: assignedTo が得られない場合でも空の配列を返すこと、rawText には可能な限り元テキスト断片を入れることを徹底してください。` +
      nameInstruction;

    let message: any | null = null;
    if (hasAnthropicKey) {
      try {
        // Dynamic import to avoid build/runtime issues when package is not
        // available or cannot be loaded in the target environment.
        const { default: Anthropic } = await import("@anthropic-ai/sdk");
        const anthClient = new Anthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });

        message = await anthClient.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 2000,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeType as
                      | "image/jpeg"
                      | "image/png"
                      | "image/gif"
                      | "image/webp",
                    data: base64Data,
                  },
                },
                {
                  type: "text",
                  text: prompt,
                },
              ],
            },
          ],
        });
      } catch (llmError) {
        console.error(
          "Anthropic import/call error - falling back to Tesseract:",
          llmError
        );
        message = null;
      }
    }

    // レスポンスからテキストを抽出（LLM 経由）または Tesseract フォールバック
    let schedules: OCRResult[] = [];
    if (message) {
      const responseText = message.content
        .filter((block: any) => block.type === "text")
        .map((block: any) => (block.type === "text" ? block.text : ""))
        .join("");

      try {
        // マークダウンのコードブロックを除去
        const cleanedText = responseText
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();

        schedules = JSON.parse(cleanedText);

        // 配列でない場合は配列に変換
        if (!Array.isArray(schedules)) {
          schedules = [schedules];
        }
      } catch (parseError) {
        console.error("JSON parse error from LLM output:", parseError);
        schedules = [];
      }
    } else {
      // LLMが使えない／失敗した場合は OCR.space によるサーバー側フォールバックを試みる
      try {
        if (process.env.OCR_SPACE_API_KEY) {
          const ocrText = await performOcrSpace(base64Data, mimeType);
          const lines = ocrText
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);
          const nm = name ? name.trim().toLowerCase().replace(/\s+/g, "") : "";
          const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, "");
          if (nm) {
            for (const line of lines) {
              if (normalize(line).includes(nm)) {
                // try to extract date/time using regex
                const dateMatch = line.match(
                  /(20\d{2}[-\/\.]\d{1,2}[-\/\.]\d{1,2})|(\d{1,2}\/\d{1,2})/
                );
                const timeMatch = line.match(/(\d{1,2}:\d{2})/g);
                const date = dateMatch ? dateMatch[1] || dateMatch[2] : null;
                const startTime = timeMatch ? timeMatch[0] : null;
                const endTime =
                  timeMatch && timeMatch.length > 1 ? timeMatch[1] : null;
                schedules.push({
                  date: date || undefined,
                  startTime: startTime || undefined,
                  endTime: endTime || undefined,
                  title: line,
                  description: "",
                  category: "other",
                  assignedTo: [name],
                  rawText: line,
                } as OCRResult);
              }
            }

            schedules = schedules || [];
          } else {
            const firstLine = lines[0] || ocrText;
            schedules.push({
              title: firstLine || "抽出された予定",
              description: "",
              category: "other",
              assignedTo: [],
              rawText: ocrText,
            } as OCRResult);
          }
        } else {
          // サーバー側での OCR 手段が無い場合は明確に伝えて失敗させる
          return NextResponse.json<APIResponse<null>>(
            {
              success: false,
              error:
                "サーバー側でのOCRが未設定です。デプロイ先で動作させるには環境変数のいずれかを設定してください: ANTHROPIC_API_KEY または OCR_SPACE_API_KEY。もしくはクライアント側で tesseract.js を使う方法に切り替えてください。",
            },
            { status: 501 }
          );
        }
      } catch (fallbackErr) {
        console.error("Server-side OCR fallback error:", fallbackErr);
        return NextResponse.json<APIResponse<null>>(
          {
            success: false,
            error: "サーバー側OCR処理中にエラーが発生しました",
          },
          { status: 500 }
        );
      }
    }

    // サーバー側でも名前フィルタをかける（クライアントから name が渡されている場合）
    if (name && name.trim()) {
      const nmRaw = name.trim();

      const normalize = (s?: string) => {
        if (!s) return "";
        // 小文字化・空白削除・全角英数字を半角化・正規化
        const fwToHw = (str: string) =>
          str
            .replace(/[-]/g, (ch) => ch)
            .replace(/[！-～]/g, (c) =>
              String.fromCharCode(c.charCodeAt(0) - 0xfee0)
            );
        return fwToHw(s)
          .normalize("NFKC")
          .toLowerCase()
          .replace(/\s+/g, "")
          .replace(/[\p{P}\p{S}]/gu, "");
      };

      // レーベンシュタイン距離（簡易実装）
      const levenshtein = (a: string, b: string) => {
        const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
          new Array(b.length + 1).fill(0)
        );
        for (let i = 0; i <= a.length; i++) dp[i][0] = i;
        for (let j = 0; j <= b.length; j++) dp[0][j] = j;
        for (let i = 1; i <= a.length; i++) {
          for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            dp[i][j] = Math.min(
              dp[i - 1][j] + 1,
              dp[i][j - 1] + 1,
              dp[i - 1][j - 1] + cost
            );
          }
        }
        return dp[a.length][b.length];
      };

      const nm = normalize(nmRaw);

      const matchesName = (item: OCRResult) => {
        // 1) まず assignedTo があればそちらを優先して照合
        const as = (item as any).assignedTo as string[] | undefined;
        if (Array.isArray(as) && as.length > 0) {
          for (const person of as) {
            const p = normalize(person);
            if (!p) continue;
            if (p.includes(nm) || nm.includes(p)) return true;
            const maxDist = Math.max(
              1,
              Math.floor(Math.max(nm.length, p.length) * 0.3)
            );
            if (levenshtein(p, nm) <= maxDist) return true;
          }
          return false;
        }

        // 2) 次に title/description/rawText を使って照合
        const fields = [item.title, item.description, (item as any).rawText]
          .filter(Boolean)
          .map((s) => normalize(String(s)));

        for (const f of fields) {
          if (f.includes(nm) || nm.includes(f)) return true;
          if (levenshtein(f, nm) <= Math.max(1, Math.floor(nm.length * 0.25)))
            return true;
        }

        return false;
      };

      const filtered = schedules.filter(matchesName);

      // 指示通り、該当がなければ空配列を返す
      schedules = filtered;
    }

    return NextResponse.json<APIResponse<OCRResult[]>>({
      success: true,
      data: schedules,
    });
  } catch (error) {
    console.error("OCR processing error:", error);

    return NextResponse.json<APIResponse<null>>(
      {
        success: false,
        error: "OCR処理中にエラーが発生しました",
      },
      { status: 500 }
    );
  }
}
