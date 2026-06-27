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

    const model = this.genAI.getGenerativeModel({
        model: modelName,
    });

    // Only set JSON mode for models that typically support it (Gemini)
    // Gemma and Imagen models might not support it via this SDK
    const isGemini = modelName.startsWith('gemini');
    const generationConfig = isGemini ? { responseMimeType: "application/json" } : {};

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig
    });
    const text = result.response.text();

    try {
        // Try to find JSON in the response if it's not pure JSON
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonToParse = jsonMatch ? jsonMatch[0] : text;
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

  public async generateImage(prompt: string, modelName: string = "imagen-4.0-generate-001"): Promise<string> {
    if (!this.genAI) return "";

    // Check if the current model is an imagen model, otherwise use default
    const imgModelName = modelName.includes('imagen') ? modelName : "imagen-4.0-generate-001";

    try {
        const model = this.genAI.getGenerativeModel({ model: imgModelName });
        const result = await model.generateContent(prompt);
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
