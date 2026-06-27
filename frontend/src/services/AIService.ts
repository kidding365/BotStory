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
        throw new Error(`Invalid AI response format from ${modelName}. Expected JSON but got: ${text.slice(0, 100)}...`);
    }
  }

  public async generateImage(prompt: string): Promise<string> {
    // Note: Google AI Studio's Imagen integration often requires specific setup
    // For now, we'll implement a placeholder or use the experimental Imagen API if available.
    // If Imagen is not directly accessible via @google/generative-ai, we might need
    // a different endpoint or a fallback.
    console.log("Generating image with prompt:", prompt);
    // Placeholder returning a random image for now to allow UI development
    return `https://picsum.photos/seed/${Math.random()}/800/600`;
  }
}
