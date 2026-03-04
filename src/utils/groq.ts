/**
 * PulseWrite – Groq API Utility (native fetch – MV3 compatible)
 * Uses the browser's built-in fetch() instead of the Node.js groq-sdk,
 * which is required for Chrome extension service workers.
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_MODEL = "llama-3.3-70b-versatile";


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
    niche?: string;
    samplePosts?: string;
}

export interface GhostwriteParams {
    topic: string;
    tone: Tone;
    length: PostLength;
    samplePosts?: string;
}

export interface PostIdea {
    title: string;
    angle: string;
}

export interface GeneratedPost {
    content: string;
    characterCount: number;
    estimatedReadTime: number;
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function callGroq(
    apiKey: string,
    messages: Array<{ role: string; content: string }>,
    options: { max_tokens?: number; temperature?: number } = {}
): Promise<string> {
    const response = await fetch(GROQ_API_URL, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            model: GROQ_MODEL,
            messages,
            temperature: options.temperature ?? 0.8,
            max_tokens: options.max_tokens ?? 800,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => "unknown error");
        throw new Error(`Groq API ${response.status}: ${errorText}`);
    }

    const data = await response.json() as {
        choices: Array<{ message: { content: string } }>;
    };
    return data.choices[0]?.message?.content ?? "";
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
    return `\nHere are some of the user's past LinkedIn posts to mirror their voice:\n\`\`\`\n${samplePosts.slice(0, 1200)}\n\`\`\`\nMirror their sentence structure, vocabulary, and personality.\n`;
}

// ─── Generate Ideas ───────────────────────────────────────────────────────────

export async function generateIdeas(
    apiKey: string,
    params: GenerateIdeasParams
): Promise<PostIdea[]> {
    const nicheStr = params.niche ? `in the ${params.niche} space` : "in a professional context";

    const systemPrompt = `You are PulseWrite, an expert LinkedIn ghostwriter.
Your job is to suggest 5 creative, high-performing LinkedIn post ideas.
${styleSection(params.samplePosts)}
Rules:
- Each idea must have a unique angle (story, insight, list, hot take, question)
- Ideas must feel native to LinkedIn — value-first, human, engaging
- ${toneInstruction(params.tone)}
- Return ONLY valid JSON — an array of 5 objects: [{"title":"...","angle":"..."}]
- No markdown, no explanation, no extra text. Just the JSON array.`;

    const raw = await callGroq(apiKey, [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Give me 5 LinkedIn post ideas ${nicheStr} in ${params.tone} tone. JSON only.` },
    ], { temperature: 0.85, max_tokens: 800 });

    // Strip markdown code fences if model wraps in ```json
    const clean = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

    // Find the JSON array even if there's extra text
    const match = clean.match(/\[[\s\S]*\]/);
    if (!match) throw new Error(`Could not parse ideas JSON. Raw: ${clean.slice(0, 200)}`);
    return JSON.parse(match[0]) as PostIdea[];
}

// ─── Ghostwrite ───────────────────────────────────────────────────────────────

export async function ghostwrite(
    apiKey: string,
    params: GhostwriteParams
): Promise<GeneratedPost> {
    const systemPrompt = `You are PulseWrite, an expert LinkedIn ghostwriter.
Write a complete, publish-ready LinkedIn post based on the topic provided.
${styleSection(params.samplePosts)}
Rules:
- ${toneInstruction(params.tone)}
- ${lengthInstruction(params.length)}
- Start with a strong hook (question, bold statement, or surprising fact)
- Use line breaks for readability — no walls of text
- End with a call-to-action or thought-provoking question
- Use emojis sparingly and only where they add value
- Write as the user, first-person perspective
- Output ONLY the post text. No title, no quotes, no extra commentary.`;

    const content = (await callGroq(apiKey, [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Topic / rough draft: "${params.topic}"` },
    ], {
        temperature: 0.78,
        max_tokens: params.length === "thread" ? 1200 : 600,
    })).trim();

    const wordCount = content.split(/\s+/).filter(Boolean).length;
    return {
        content,
        characterCount: content.length,
        estimatedReadTime: Math.ceil(wordCount / 4),
    };
}
