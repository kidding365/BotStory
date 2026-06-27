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
        generationConfig: {
            responseMimeType: "application/json"
        }
    });

    const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }]
    });
    const text = result.response.text();

    try {
        return JSON.parse(text);
    } catch (e) {
        console.error("Failed to parse AI response as JSON", text);
        throw new Error("Invalid AI response format.");
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
