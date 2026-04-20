import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

const IMAGE_PROMPT = `Act as an advanced, highly-detailed deterministic data parser. Your task is to convert my provided image description into a rich, structured JSON format conforming to a professional schema. 
Adhere to a strict "Zero-Inference" policy: do not add artistic styles, lighting effects, camera settings, or objects unless explicitly stated in my text. 
HOWEVER, you must extract every single provided detail and organize it into a highly granular, deeply nested structure. 
Use comprehensive keys (e.g., "master_prompt", "subjects" (array of objects with traits, poses, explicit colors), "environment", "composition_and_style", etc.). 
If the prompt is brief, provide a highly professional schema but leave unmentioned advanced fields out or null rather than inventing facts. The goal is maximum structural and analytical detail based strictly on the literal input. Output only the JSON.`;

const VIDEO_PROMPT = `Act as an advanced technical video metadata extractor. Transform my video description into a highly granular, professional JSON schema. 
Adhere to a strict "Literal Evidence" rule: do not infer camera angles, frame rates, or audio unless mentioned. 
HOWEVER, break down the provided text into exceptional structural detail. 
Use a comprehensive schema including: "master_prompt", "primary_subjects", "environment", "temporal_flow" (array of strict sequential events based on the text), and "technical_specs" (if stated). 
Extract every single adjective, action, and relationship into specifically named nested keys. Do not invent scenes, but ensure the resulting JSON is structurally sophisticated and heavily detailed based only on the true text. Output only the JSON.`;

export async function POST(req: Request) {
  try {
    const { input, media, targetMode } = await req.json();
    
    const apiKey = process.env.CUSTOM_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server missing CUSTOM_GEMINI_API_KEY. Please set your API key in Settings > Secrets." }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Process inputs
    const parts: any[] = [];
    if (input) parts.push({ text: input });
    if (media && Array.isArray(media)) {
      media.forEach((m: any) => {
        parts.push({
          inlineData: {
            data: m.data.split(',')[1],
            mimeType: m.mimeType
          }
        });
      });
    }

    const systemInstruction = targetMode === 'video' ? VIDEO_PROMPT : IMAGE_PROMPT;

    // 1. Generate JSON Prompt
    const promptResponse = await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.1, // Low temp for strictly deterministic data extraction
      }
    });

    let jsonStr = promptResponse.text || '{}';
    
    // Extract everything between the first and last structural braces/brackets to ignore conversational text
    const firstBrace = jsonStr.indexOf('{');
    const firstBracket = jsonStr.indexOf('[');
    let firstChar = firstBrace;
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      firstChar = firstBracket;
    }
    
    const lastBrace = jsonStr.lastIndexOf('}');
    const lastBracket = jsonStr.lastIndexOf(']');
    const lastChar = Math.max(lastBrace, lastBracket);
    
    if (firstChar !== -1 && lastChar !== -1 && lastChar >= firstChar) {
      jsonStr = jsonStr.substring(firstChar, lastChar + 1);
    } else {
      // Fallback if no braces found (e.g. malformed response)
      jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();
    }
    
    const payload = JSON.parse(jsonStr);

    return NextResponse.json({ payload });
  } catch (error: any) {
    console.error("API error during prompt generation:", error);
    
    // Add debug info to see if the key is the dummy value or getting truncated
    const currentKey = process.env.CUSTOM_GEMINI_API_KEY || "";
    let debugInfo = "Key is missing";
    if (currentKey) {
      debugInfo = `Key starts with: "${currentKey.substring(0, 5)}...", ends with: "...${currentKey.substring(currentKey.length - 4)}", Length: ${currentKey.length}`;
      if (currentKey.includes('MY_GEMINI_API_KEY') || currentKey.includes('env') || currentKey.includes(' ')) {
        debugInfo += " (Looks like the placeholder or has spaces!)";
      }
    }

    const errorMsg = error.message ? error.message : JSON.stringify(error);
    
    // Catch Rate Limits to show a friendly error
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json({ 
        error: "Slow down! 🛑 You are testing too fast and hit the Gemini Free Tier speed limit. Please wait about 30 seconds and try again." 
      }, { status: 429 });
    }

    return NextResponse.json({ error: `Backend Error: ${errorMsg} | Debug: ${debugInfo}` }, { status: 500 });
  }
}
