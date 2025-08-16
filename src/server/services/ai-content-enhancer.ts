import { TRPCError } from "@trpc/server";

export enum AIEnhancementType {
  POLISH = "polish",
  GENERATE = "generate",
  SUMMARIZE = "summarize",
  EXPAND = "expand",
  TRANSLATE = "translate"
}

export enum ContentTone {
  PROFESSIONAL = "professional",
  CASUAL = "casual",
  FRIENDLY = "friendly",
  FORMAL = "formal",
  HUMOROUS = "humorous",
  INSPIRATIONAL = "inspirational"
}

export enum ContentLength {
  SHORT = "short",
  MEDIUM = "medium",
  LONG = "long"
}

export interface AIEnhancementRequest {
  type: AIEnhancementType;
  content?: string; // For polish, summarize, expand, translate
  topic?: string; // For generate
  tone?: ContentTone;
  length?: ContentLength;
  targetLanguage?: string; // For translate
  additionalInstructions?: string;
  includeHashtags?: boolean;
  includeEmojis?: boolean;
  targetPlatforms?: string[]; // For platform-specific optimization
}

export interface AIEnhancementResult {
  enhancedContent: string;
  suggestions?: string[];
  hashtags?: string[];
  metadata?: {
    wordCount: number;
    characterCount: number;
    estimatedReadTime: number;
    tone: string;
    platforms: string[];
  };
}

export class AIContentEnhancer {
  private readonly openaiApiKey: string;
  private readonly baseUrl = "https://api.openai.com/v1";

  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY!;

    if (!this.openaiApiKey) {
      throw new Error("OpenAI API key not configured");
    }
  }

  /**
   * Enhance content using AI
   */
  async enhanceContent(request: AIEnhancementRequest): Promise<AIEnhancementResult> {
    try {
      const prompt = this.buildPrompt(request);
      const response = await this.callOpenAI(prompt);

      return this.parseResponse(response, request);
    } catch (error) {
      console.error("AI content enhancement failed:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to enhance content with AI"
      });
    }
  }

  /**
   * Generate multiple content variations
   */
  async generateVariations(request: AIEnhancementRequest, count: number = 3): Promise<AIEnhancementResult[]> {
    try {
      const variations: AIEnhancementResult[] = [];

      for (let i = 0; i < count; i++) {
        const variationRequest = {
          ...request,
          additionalInstructions: `${request.additionalInstructions || ''} Create variation ${i + 1} with a different approach.`
        };

        const result = await this.enhanceContent(variationRequest);
        variations.push(result);
      }

      return variations;
    } catch (error) {
      console.error("Failed to generate content variations:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate content variations"
      });
    }
  }

  /**
   * Get content suggestions based on topic
   */
  async getContentSuggestions(topic: string, platform?: string): Promise<string[]> {
    try {
      const prompt = `Generate 5 engaging content ideas about "${topic}"${platform ? ` for ${platform}` : ''}. 
      Return only the ideas as a numbered list, each on a new line.`;

      const response = await this.callOpenAI(prompt);

      // Parse the numbered list
      return response
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .filter(line => line.length > 0);
    } catch (error) {
      console.error("Failed to get content suggestions:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to get content suggestions"
      });
    }
  }

  /**
   * Analyze content for insights
   */
  async analyzeContent(content: string): Promise<{
    tone: string;
    sentiment: string;
    readabilityScore: number;
    keyTopics: string[];
    suggestedImprovements: string[];
  }> {
    try {
      const prompt = `Analyze this content and provide insights:
      "${content}"
      
      Return a JSON object with:
      - tone: the overall tone (professional, casual, friendly, etc.)
      - sentiment: positive, negative, or neutral
      - readabilityScore: 1-10 (10 being most readable)
      - keyTopics: array of main topics/themes
      - suggestedImprovements: array of specific improvement suggestions
      
      Return only valid JSON.`;

      const response = await this.callOpenAI(prompt);

      try {
        return JSON.parse(response);
      } catch {
        // Fallback if JSON parsing fails
        return {
          tone: "neutral",
          sentiment: "neutral",
          readabilityScore: 5,
          keyTopics: [],
          suggestedImprovements: ["Unable to analyze content automatically"]
        };
      }
    } catch (error) {
      console.error("Failed to analyze content:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to analyze content"
      });
    }
  }

  /**
   * Build prompt based on enhancement request
   */
  private buildPrompt(request: AIEnhancementRequest): string {
    let prompt = "";

    switch (request.type) {
      case AIEnhancementType.POLISH:
        prompt = `Polish and improve this content while maintaining its core message:
        "${request.content}"
        
        Make it more engaging, fix any grammar issues, and improve clarity.`;
        break;

      case AIEnhancementType.GENERATE:
        prompt = `Generate engaging social media content about: ${request.topic}
        
        Create original, compelling content that would perform well on social media.`;
        break;

      case AIEnhancementType.SUMMARIZE:
        prompt = `Summarize this content in a concise, engaging way:
        "${request.content}"
        
        Keep the key points while making it more digestible.`;
        break;

      case AIEnhancementType.EXPAND:
        prompt = `Expand on this content with more details and context:
        "${request.content}"
        
        Add valuable information while keeping it engaging.`;
        break;

      case AIEnhancementType.TRANSLATE:
        prompt = `Translate this content to ${request.targetLanguage}:
        "${request.content}"
        
        Maintain the tone and style while making it natural in the target language.`;
        break;
    }

    // Add tone specification
    if (request.tone) {
      prompt += `\n\nTone: ${request.tone}`;
    }

    // Add length specification
    if (request.length) {
      const lengthGuide = {
        [ContentLength.SHORT]: "Keep it concise (1-2 sentences or under 280 characters)",
        [ContentLength.MEDIUM]: "Medium length (2-4 sentences or 280-500 characters)",
        [ContentLength.LONG]: "Longer form (multiple paragraphs, detailed)"
      };
      prompt += `\n\nLength: ${lengthGuide[request.length]}`;
    }

    // Add platform-specific optimization
    if (request.targetPlatforms && request.targetPlatforms.length > 0) {
      prompt += `\n\nOptimize for these platforms: ${request.targetPlatforms.join(', ')}`;
    }

    // Add hashtag request
    if (request.includeHashtags) {
      prompt += `\n\nInclude relevant hashtags at the end.`;
    }

    // Add emoji request
    if (request.includeEmojis) {
      prompt += `\n\nInclude appropriate emojis to make it more engaging.`;
    }

    // Add additional instructions
    if (request.additionalInstructions) {
      prompt += `\n\nAdditional instructions: ${request.additionalInstructions}`;
    }

    return prompt;
  }

  /**
   * Call OpenAI API
   */
  private async callOpenAI(prompt: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // Using the more cost-effective model
        messages: [
          {
            role: 'system',
            content: 'You are a professional social media content creator and copywriter. Create engaging, high-quality content that performs well on social media platforms.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || '';
  }

  /**
   * Parse AI response and extract metadata
   */
  private parseResponse(response: string, request: AIEnhancementRequest): AIEnhancementResult {
    // Extract hashtags if present
    const hashtagRegex = /#[\w]+/g;
    const hashtags = response.match(hashtagRegex) || [];

    // Remove hashtags from main content for clean separation
    const cleanContent = response.replace(hashtagRegex, '').trim();

    // Calculate metadata
    const wordCount = cleanContent.split(/\s+/).length;
    const characterCount = cleanContent.length;
    const estimatedReadTime = Math.ceil(wordCount / 200); // Average reading speed

    return {
      enhancedContent: cleanContent,
      hashtags: hashtags.map(tag => tag.substring(1)), // Remove # symbol
      metadata: {
        wordCount,
        characterCount,
        estimatedReadTime,
        tone: request.tone || 'neutral',
        platforms: request.targetPlatforms || []
      }
    };
  }
}