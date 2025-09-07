import { supabase } from '@/lib/supabase';

export interface GenerateQuestionsOptions {
  content: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  questionTypes: string[];
  subject?: string;
  focus?: string;
}

export interface ProcessNotesOptions {
  content?: string;
  fileData?: string;
  fileName?: string;
  fileType?: string;
}

export interface ProcessedContent {
  text: string;
  title: string;
  topics: string[];
  summary: string;
  wordCount: number;
  estimatedReadingTime: number;
}

export interface GeneratedQuestion {
  id: string;
  type: 'multiple-choice' | 'true-false';
  question: string;
  options?: string[];
  correctAnswer: string;
  explanation: string;
  difficulty: 'easy' | 'medium' | 'hard';
  points: number;
  sourceText?: string;
  confidence?: number;
}

export interface AIResponse {
  questions: GeneratedQuestion[];
  metadata: {
    totalQuestions: number;
    estimatedTime: number;
    difficulty: string;
    subject?: string;
    contentHash: string;
  };
  warning?: string;
}

class AIService {
  async processNotes(options: ProcessNotesOptions): Promise<ProcessedContent> {
    try {
      console.log('Processing notes with AI...');
      
      const { data, error } = await supabase.functions.invoke('process-notes', {
        body: options
      });

      if (error) {
        console.error('Error calling process-notes function:', error);
        // Return fallback processing
        return this.fallbackProcessNotes(options);
      }

      // If AI failed but we got a fallback response
      if (data.error && data.fallback) {
        console.warn('AI processing failed, using fallback:', data.error);
        return data.fallback;
      }

      return data;
    } catch (error) {
      console.error('Failed to process notes:', error);
      return this.fallbackProcessNotes(options);
    }
  }

  async generateQuestions(options: GenerateQuestionsOptions): Promise<AIResponse> {
    try {
      console.log('Generating questions with AI...', options);
      
      const { data, error } = await supabase.functions.invoke('generate-questions', {
        body: options
      });

      if (error) {
        console.error('Error calling generate-questions function:', error);
        throw new Error(`Failed to generate questions: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Failed to generate questions:', error);
      throw error;
    }
  }

  private fallbackProcessNotes(options: ProcessNotesOptions): ProcessedContent {
    const text = options.content || '';
    const words = text.split(/\s+/).filter(w => w.length > 0);
    
    // Simple fallback processing
    const title = options.fileName?.replace(/\.[^/.]+$/, "") || 'Study Material';
    const topics = this.extractSimpleTopics(text);
    const summary = text.substring(0, 200) + (text.length > 200 ? '...' : '');
    
    return {
      text,
      title,
      topics,
      summary,
      wordCount: words.length,
      estimatedReadingTime: Math.ceil(words.length / 200)
    };
  }

  private extractSimpleTopics(text: string): string[] {
    // Simple keyword extraction fallback
    const words = text.toLowerCase().split(/\W+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must', 'shall', 'this', 'that', 'these', 'those']);
    
    const wordFreq: Record<string, number> = {};
    words.forEach(word => {
      if (word.length > 3 && !commonWords.has(word)) {
        wordFreq[word] = (wordFreq[word] || 0) + 1;
      }
    });
    
    return Object.entries(wordFreq)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6)
      .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
  }

  async processFile(file: File): Promise<ProcessedContent> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const result = e.target?.result;
          if (typeof result === 'string') {
            // For text files, use the content directly
            if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
              const processed = await this.processNotes({
                content: result,
                fileName: file.name,
                fileType: file.type
              });
              resolve(processed);
            } else {
              // For other files, send as base64
              const base64Data = btoa(result);
              const processed = await this.processNotes({
                fileData: base64Data,
                fileName: file.name,
                fileType: file.type
              });
              resolve(processed);
            }
          } else {
            reject(new Error('Failed to read file'));
          }
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      if (file.type.includes('text') || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  }

  // Legacy methods for backwards compatibility
  async generateFlashcards(content: string, count: number = 10) {
    // This can be implemented later or kept as a placeholder
    console.warn('generateFlashcards not yet implemented with new backend');
    return { flashcards: [] };
  }

  async createTest(formData: FormData): Promise<any> {
    // This can be implemented later if needed
    console.warn('createTest not yet implemented with new backend');
    return {};
  }

  async getUserTests(): Promise<any[]> {
    // This can be implemented later if needed
    console.warn('getUserTests not yet implemented with new backend');
    return [];
  }

  async submitTestResults(testId: string, results: any): Promise<any> {
    // This can be implemented later if needed
    console.warn('submitTestResults not yet implemented with new backend');
    return {};
  }
}

export const aiService = new AIService();