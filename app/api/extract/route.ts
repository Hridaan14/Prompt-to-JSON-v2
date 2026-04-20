import { GoogleGenAI } from '@google/genai';
import { NextResponse } from 'next/server';

const EXTRACT_IMAGE_PROMPT = `You are a hyper-detailed forensic visual analyst. Your task is to examine the provided image and extract every single observable detail — leaving absolutely nothing out. Convert everything into a deeply nested, richly structured JSON object. Your JSON must include but is not limited to: all subjects present (with physical traits, colors, textures, clothing, accessories, expressions, poses, gestures, spatial relationships), environment (setting, time of day, weather, surfaces, materials, spatial depth), lighting (sources, direction, intensity, shadows, highlights, color temperature, rim light, fill light), color palette (dominant colors with approximate hex or descriptive values, undertones, contrast level, saturation), composition (framing, shot type, camera angle, depth of field, rule of thirds adherence, focal point), atmosphere and mood, style (photographic, illustrated, rendered, painterly — describe all stylistic indicators), and any text, symbols, logos, or graphic elements present. For each attribute, go as deep as structurally possible. Use nested objects and arrays. Never use vague terms — always be specific. Output only the JSON, no explanation, no markdown fences.`;

const EXTRACT_VIDEO_PROMPT = `You are a hyper-detailed forensic video analyst. Your task is to examine the provided video and extract every single observable and inferable detail — leaving absolutely nothing out. Convert everything into a deeply nested, richly structured JSON object. Your JSON must include: all subjects present (physical traits, clothing, expressions, actions, movements, interactions), scene composition (shot types used, camera angles, framing changes), temporal flow (array of sequential events with descriptions, estimated timestamps if inferrable), camera behavior (cuts, pans, zooms, handheld vs stabilized, transitions), environment (setting, time, weather, surfaces, materials), lighting (per scene if it changes — sources, direction, mood, color temperature), color grading (palette, tone, saturation, contrast, any stylistic grading), audio indicators (if visually implied — music, dialogue, ambient sound), motion characteristics (speed, direction, blur, smoothness), and overall mood and style. Structure everything as deeply nested JSON. Be maximally specific. Output only the JSON, no explanation, no markdown fences.`;

export async function POST(req: Request) {
  try {
    const { media } = await req.json();
    
    const apiKey = process.env.CUSTOM_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Server missing CUSTOM_GEMINI_API_KEY. Please set your API key in Settings > Secrets." }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    if (!media || media.length === 0) {
      return NextResponse.json({ error: "No media provided." }, { status: 400 });
    }

    const file = media[0]; // Process the first file
    const isVideo = file.mimeType.startsWith('video/');

    const parts = [{
      inlineData: {
        data: file.data.split(',')[1],
        mimeType: file.mimeType
      }
    }];

    const systemInstruction = isVideo ? EXTRACT_VIDEO_PROMPT : EXTRACT_IMAGE_PROMPT;

    // Generate JSON Extractor response
    const promptResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.1,
      }
    });

    let jsonStr = promptResponse.text || '{}';
    
    // Parse response
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
      jsonStr = jsonStr.replace(/```json/gi, '').replace(/```/g, '').trim();
    }
    
    const payload = JSON.parse(jsonStr);

    return NextResponse.json({ payload });
  } catch (error: any) {
    console.error("API error during extraction:", error);
    
    const currentKey = process.env.CUSTOM_GEMINI_API_KEY || "";
    let debugInfo = "Key is missing";
    if (currentKey) {
      debugInfo = `Key starts with: "${currentKey.substring(0, 5)}...", Length: ${currentKey.length}`;
    }

    const errorMsg = error.message ? error.message : JSON.stringify(error);
    
    if (errorMsg.includes('429') || errorMsg.includes('quota') || errorMsg.includes('RESOURCE_EXHAUSTED')) {
      return NextResponse.json({ 
        error: "Slow down! 🛑 You hit the speed limit. Please wait about 30 seconds." 
      }, { status: 429 });
    }

    return NextResponse.json({ error: `Backend Error: ${errorMsg} | Debug: ${debugInfo}` }, { status: 500 });
  }
}
