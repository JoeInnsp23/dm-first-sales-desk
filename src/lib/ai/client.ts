import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";

export type AIProvider = "anthropic" | "openai";

export type AIModel =
  | "claude-3-5-sonnet"
  | "claude-3-haiku"
  | "gpt-4"
  | "gpt-3.5-turbo";

export interface AIResponse {
  content: string;
  tokensUsed: number;
  costUsd: number;
  model: string;
}

export class AIClient {
  private anthropic: Anthropic | null = null;
  private openai: OpenAI | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
    }

    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
    }
  }

  /**
   * Generate a completion using the specified model
   */
  async complete(
    prompt: string,
    options: {
      model?: AIModel;
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<AIResponse> {
    const {
      model = "claude-3-5-sonnet",
      systemPrompt,
      maxTokens = 1000,
      temperature = 0.7,
    } = options;

    if (model.startsWith("claude")) {
      return this.completeWithClaude(prompt, {
        model: model as any,
        systemPrompt,
        maxTokens,
        temperature,
      });
    } else {
      return this.completeWithOpenAI(prompt, {
        model: model as any,
        systemPrompt,
        maxTokens,
        temperature,
      });
    }
  }

  /**
   * Complete with Claude
   */
  private async completeWithClaude(
    prompt: string,
    options: {
      model: "claude-3-5-sonnet" | "claude-3-haiku";
      systemPrompt?: string;
      maxTokens: number;
      temperature: number;
    }
  ): Promise<AIResponse> {
    if (!this.anthropic) {
      throw new Error("Anthropic API key not configured");
    }

    const modelMap = {
      "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
      "claude-3-haiku": "claude-3-5-haiku-20241022",
    };

    const response = await this.anthropic.messages.create({
      model: modelMap[options.model],
      max_tokens: options.maxTokens,
      temperature: options.temperature,
      system: options.systemPrompt,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });

    const content =
      response.content[0].type === "text" ? response.content[0].text : "";

    // Calculate cost (approximate)
    const costPer1kTokens = options.model === "claude-3-5-sonnet" ? 0.003 : 0.00025;
    const tokensUsed = response.usage.input_tokens + response.usage.output_tokens;
    const costUsd = (tokensUsed / 1000) * costPer1kTokens;

    return {
      content,
      tokensUsed,
      costUsd: Math.round(costUsd * 100), // Convert to cents
      model: modelMap[options.model],
    };
  }

  /**
   * Complete with OpenAI
   */
  private async completeWithOpenAI(
    prompt: string,
    options: {
      model: "gpt-4" | "gpt-3.5-turbo";
      systemPrompt?: string;
      maxTokens: number;
      temperature: number;
    }
  ): Promise<AIResponse> {
    if (!this.openai) {
      throw new Error("OpenAI API key not configured");
    }

    const messages: any[] = [];

    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }

    messages.push({ role: "user", content: prompt });

    const response = await this.openai.chat.completions.create({
      model: options.model,
      messages,
      max_tokens: options.maxTokens,
      temperature: options.temperature,
    });

    const content = response.choices[0]?.message?.content || "";
    const tokensUsed = response.usage?.total_tokens || 0;

    // Calculate cost (approximate)
    const costPer1kTokens = options.model === "gpt-4" ? 0.03 : 0.0015;
    const costUsd = (tokensUsed / 1000) * costPer1kTokens;

    return {
      content,
      tokensUsed,
      costUsd: Math.round(costUsd * 100), // Convert to cents
      model: options.model,
    };
  }
}

// Singleton instance
let aiClient: AIClient | null = null;

export function getAIClient(): AIClient {
  if (!aiClient) {
    aiClient = new AIClient();
  }
  return aiClient;
}
