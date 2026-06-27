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
        // Fallback: If it's not JSON, wrap the plain text into a valid object
        if (text && text.length > 10) {
            return {
                narrative: text,
                stateUpdates: [],
                suggestedActions: [],
                imagePrompt: text.slice(0, 100)
            };
        }
        throw new Error(`Invalid AI response format from ${modelName}. Expected JSON but got: ${text.slice(0, 100)}...`);
    }
  }

  public async generateImage(prompt: string, modelName: string = "imagen-3.0-generate-001"): Promise<string> {
    if (!this.genAI) return "";

    // Some regions/keys don't support Imagen via the standard SDK yet.
    // If it starts with gemini, we can try to use it as an image generator if supported,
    // but usually, we want to stick to the dedicated imagen models.
    const imgModelName = modelName;
    console.log(`[AIService] Generating image with model: ${imgModelName}`);

    try {
        const model = this.genAI.getGenerativeModel({ model: imgModelName });
        // Set a shorter timeout or simpler config if needed
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        const response = result.response;

        // Google Imagen usually returns images in a specific way in the response
        // For standard AI Studio integration, we check for candidates with data
        const candidates = response.candidates;
        if (candidates && candidates[0]?.content?.parts?.[0]?.inlineData) {
            const data = candidates[0].content.parts[0].inlineData;
            return `data:${data.mimeType};base64,${data.data}`;
        }
    } catch (e) {
        console.error("Image generation failed:", e);
    }

    // Fallback to picsum if Imagen fails or is not accessible
    return `https://picsum.photos/seed/${encodeURIComponent(prompt.slice(0, 20))}/800/600`;
  }
}
