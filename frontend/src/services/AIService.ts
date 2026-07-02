import { GoogleGenerativeAI } from "@google/generative-ai";

export class AIService {
  private genAI: GoogleGenerativeAI | null = null;

  constructor(apiKey: string | null) {
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  public async generateStoryResponse(prompt: string, modelName: string) {
    if (!this.genAI) throw new Error("API Key not configured.");

    const systemInstruction = `You are a world-class novelist and interactive story engine.
You MUST respond with ONLY a valid JSON object. Do not include any commentary or conversational filler.

The JSON object MUST have these keys:
- narrative (string): The story text for this turn.
- stateUpdates (array of {itemId: string, newValue: any}): Changes to the world state.
- suggestedActions (array of strings): 3 possible next actions for the player.
- imagePrompt (string): A highly detailed, vivid visual description of the EXACT scene described in the narrative.

Example:
{
  "narrative": "...",
  "stateUpdates": [],
  "suggestedActions": ["...", "...", "..."],
  "imagePrompt": "..."
}`;

    const model = this.genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: {
            role: "system",
            parts: [{ text: systemInstruction }]
        }
    });

    // Only set JSON mode for models that typically support it (Gemini)
    const isGemini = modelName.startsWith('gemini');
    const generationConfig = isGemini ? { responseMimeType: "application/json" } : {};

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
    });
    const text = result.response.text();
    console.log(`[AIService] Raw response from ${modelName}:`, text);

    try {
        // Try to find JSON in the response if it's not pure JSON
        // We look for the first '{' and the last '}'
        const firstBrace = text.indexOf('{');
        const lastBrace = text.lastIndexOf('}');

        if (firstBrace === -1 || lastBrace === -1 || lastBrace < firstBrace) {
            throw new Error("No JSON object found in response");
        }

        let jsonToParse = text.substring(firstBrace, lastBrace + 1);

        // Minimal cleaning for common LLM errors (like trailing commas before closing braces)
        // This is a naive fix but covers many common cases
        jsonToParse = jsonToParse.replace(/,\s*([\]\}])/g, '$1');

        return JSON.parse(jsonToParse);
    } catch (e) {
        console.error("Failed to parse AI response as JSON", text);

        // Advanced cleanup: remove prompt-like echoes
        let cleanedText = text;
        const promptEchoes = [
            "Continue the story based on the history",
            "You MUST respond with a JSON object",
            "CRITICAL:",
            "World visual style:",
            "WORLD SETTING:",
            "BACKGROUND:",
            "CORE INSTRUCTIONS:",
            "AUTHOR STYLE:",
            "CURRENT STORY TRUTHS:",
            "WORLD STATE:",
            "PLAYER CHARACTER:",
            "DESCRIPTION:",
            "SKILLS:",
            "STORY HISTORY",
            "RELEVANT LORE:",
            "USER ACTION:"
        ];

        promptEchoes.forEach(echo => {
            const index = cleanedText.indexOf(echo);
            if (index !== -1) {
                // If the echo is near the start, take everything AFTER the last known prompt echo
                cleanedText = cleanedText.substring(index + echo.length).trim();
            }
        });

        // Fallback: If it's not JSON, wrap the cleaned text into a valid object
        if (cleanedText && cleanedText.length > 10) {
            return {
                narrative: cleanedText,
                stateUpdates: [],
                suggestedActions: [
                    "Explore the surroundings further.",
                    "Reflect on the current situation.",
                    "Look for potential allies or items."
                ],
                imagePrompt: cleanedText.slice(0, 100)
            };
        }
        throw new Error(`Invalid AI response format from ${modelName}. Expected JSON but got: ${text.slice(0, 100)}...`);
    }
  }

  public async generateImage(prompt: string, modelName: string): Promise<string> {
    if (!this.genAI) return "";

    // Ordered list of models to try for image generation
    const fallbacks = [
        modelName, // Try user choice first
        "imagen-4.0-generate-001",
        "gemini-3.1-flash-tts-preview",
        "gemini-1.5-flash",
        "gemini-1.5-pro"
    ];

    // Remove duplicates and filter empty
    const attemptList = Array.from(new Set(fallbacks)).filter(m => !!m);

    for (const imgModelName of attemptList) {
        try {
            console.log(`[AIService] Attempting image generation with model: ${imgModelName}`);
            const model = this.genAI.getGenerativeModel({ model: imgModelName });

            const result = await model.generateContent({
                contents: [{ role: 'user', parts: [{ text: prompt }] }]
            });
            const response = result.response;

            const candidates = response.candidates;
            if (candidates && candidates[0]?.content?.parts?.[0]?.inlineData) {
                const data = candidates[0].content.parts[0].inlineData;
                return `data:${data.mimeType};base64,${data.data}`;
            }
        } catch (e: any) {
            console.warn(`[AIService] Image generation failed for ${imgModelName}:`, e.message);
            // If it's a non-retryable error (like 404 or modality not supported), we continue to next
            // If it's 429, we also continue to try other models that might have quota
            continue;
        }
    }

    // Ultimate Fallback to picsum if all AI models fail
    console.warn("[AIService] All AI image models failed or reached quota. Using stock fallback.");
    const seed = encodeURIComponent(prompt.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 50));
    return `https://picsum.photos/seed/${seed}/800/600`;
  }
}
