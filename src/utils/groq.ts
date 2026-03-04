/**
 * PulseWrite – Groq API Utility
 * All calls go through the background service worker to avoid CORS/CSP.
 * This file runs inside the background script context.
 */

import Groq from "groq-sdk";

// ─── Constants ────────────────────────────────────────────────────────────────
export const GROQ_MODEL = "llama-3.1-70b-versatile";

// ─── Types ────────────────────────────────────────────────────────────────────
export type Tone =
    | "professional"
    | "casual"
    | "inspirational"
    | "savage"
    | "humorous"
    | "thought-leadership";

export type PostLength = "short" | "medium" | "thread";

export interface GenerateIdeasParams {
    tone: Tone;
    niche?: string;       // e.g. "software engineering", "marketing"
    samplePosts?: string; // user's past posts joined by \n---\n
}

export interface GhostwriteParams {
    topic: string;        // raw topic or rough draft typed by user
    tone: Tone;
    length: PostLength;
    samplePosts?: string;
}

export interface PostIdea {
    title: string;   // one-liner hook
    angle: string;   // brief description of the angle
}

export interface GeneratedPost {
    content: string;
    characterCount: number;
    estimatedReadTime: number; // seconds
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGroqClient(apiKey: string): Groq {
    return new Groq({ apiKey, dangerouslyAllowBrowser: true });
}

function toneInstruction(tone: Tone): string {
    const map: Record<Tone, string> = {
        "professional": "Write in a polished, expert tone. Data-backed, clear, no fluff.",
        "casual": "Write like you're texting a smart friend. Conversational, human, warm.",
        "inspirational": "Write with high energy and optimism. Rally the reader. Short punchy lines.",
        "savage": "Write with brutal honesty and contrarian takes. Bold, witty, no-filter.",
        "humorous": "Write with dry wit and relatable humor. Make readers smile while learning.",
        "thought-leadership": "Write with authority and depth. Challenge assumptions. Leave readers thinking.",
    };
    return map[tone];
}

function lengthInstruction(length: PostLength): string {
    const map: Record<PostLength, string> = {
        "short": "Keep it under 200 characters — short, punchy, one key insight.",
        "medium": "Write 280–500 characters. Hook, 2–3 insight lines, call-to-action.",
        "thread": "Write a 3-part LinkedIn thread. Part 1: hook. Part 2: details. Part 3: CTA. Separate parts with '---PART---'.",
    };
    return map[length];
}

function styleSection(samplePosts?: string): string {
    if (!samplePosts?.trim()) return "";
    return `\nHere are some of the user's past LinkedIn posts to mirror their voice:\n\`\`\`\n${samplePosts.slice(0, 1200)}\n\`\`\`\nMirror their sentence structure, vocabulary level, and personality.\n`;
}

// ─── Generate Ideas ───────────────────────────────────────────────────────────

export async function generateIdeas(
    apiKey: string,
    params: GenerateIdeasParams
): Promise<PostIdea[]> {
    const groq = getGroqClient(apiKey);
    const nicheStr = params.niche ? `in the ${params.niche} space` : "in a professional context";

    const systemPrompt = `You are PulseWrite, an expert LinkedIn ghostwriter.
Your job is to suggest 5 creative, high-performing LinkedIn post ideas.
${styleSection(params.samplePosts)}
Rules:
- Each idea must have a unique angle (story, insight, list, hot take, question, etc.)
- Ideas must feel native to LinkedIn — value-first, human, engaging
- ${toneInstruction(params.tone)}
- Return ONLY valid JSON — an array of 5 objects: { "title": "...", "angle": "..." }
- No markdown, no explanation, no extra text — just the JSON array.`;

    const userPrompt = `Give me 5 high-quality LinkedIn post ideas ${nicheStr} in a ${params.tone} tone. Return only the JSON array.`;

    const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
        ],
        temperature: 0.85,
        max_tokens: 800,
    });

    const raw = completion.choices[0]?.message?.content ?? "[]";

    // Strip any markdown code fences if Groq wraps the JSON
    const clean = raw.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
    return JSON.parse(clean) as PostIdea[];
}

// ─── Ghostwrite ───────────────────────────────────────────────────────────────

export async function ghostwrite(
    apiKey: string,
    params: GhostwriteParams
): Promise<GeneratedPost> {
    const groq = getGroqClient(apiKey);

    const systemPrompt = `You are PulseWrite, an expert LinkedIn ghostwriter.
Write a complete, publish-ready LinkedIn post based on the topic provided.
${styleSection(params.samplePosts)}
Rules:
- ${toneInstruction(params.tone)}
- ${lengthInstruction(params.length)}
- Start with a strong hook (question, bold statement, or surprising fact)
- Use line breaks for readability — no walls of text
- End with a call-to-action or thought-provoking question
- Use emojis sparingly and only where they add value (not in every line)
- Write as the user, from their perspective (first-person)
- Output ONLY the post text — no title, no quotation marks, no extra commentary.`;

    const completion = await groq.chat.completions.create({
        model: GROQ_MODEL,
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Topic / rough draft: "${params.topic}"` },
        ],
        temperature: 0.78,
        max_tokens: params.length === "thread" ? 1200 : 600,
    });

    const content = (completion.choices[0]?.message?.content ?? "").trim();
    const characterCount = content.length;
    const wordCount = content.split(/\s+/).filter(Boolean).length;
    const estimatedReadTime = Math.ceil(wordCount / 4); // ~250 wpm, then /60

    return { content, characterCount, estimatedReadTime };
}
