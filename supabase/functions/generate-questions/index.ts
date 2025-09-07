import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GenerateQuestionsRequest {
  content: string;
  difficulty: 'easy' | 'medium' | 'hard';
  questionCount: number;
  questionTypes: string[];
  subject?: string;
  focus?: string;
}

interface GeneratedQuestion {
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

interface AIResponse {
  questions: GeneratedQuestion[];
  metadata: {
    totalQuestions: number;
    estimatedTime: number;
    difficulty: string;
    subject?: string;
    contentHash: string;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.log('No Gemini API key found, returning mock questions');
      const request: GenerateQuestionsRequest = await req.json();
      const mockResponse = generateMockQuestions(request);
      return new Response(JSON.stringify(mockResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const request: GenerateQuestionsRequest = await req.json();
    
    // Validate request
    if (!request.content || !request.difficulty || !request.questionCount || !request.questionTypes) {
      throw new Error('Missing required parameters');
    }

    console.log(`Generating ${request.questionCount} questions using Gemini Pro`);
    
    const response = await generateWithGemini(request, geminiApiKey);
    
    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in generate-questions function:', error);
    
    // Fallback to mock questions on error
    try {
      const request: GenerateQuestionsRequest = await req.json();
      const mockResponse = generateMockQuestions(request);
      return new Response(JSON.stringify({
        ...mockResponse,
        warning: 'AI generation failed, using fallback questions'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    } catch (fallbackError) {
      return new Response(JSON.stringify({ 
        error: error.message,
        fallbackError: fallbackError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }
});

async function generateWithGemini(request: GenerateQuestionsRequest, apiKey: string): Promise<AIResponse> {
  const { content, difficulty, questionCount, questionTypes, subject, focus } = request;
  
  const isTrueFalse = questionTypes.includes('true-false');
  const isMultipleChoice = questionTypes.includes('mcq') || questionTypes.includes('multiple-choice');
  
  const prompt = `You are an expert educational content creator and assessment designer with deep expertise in creating high-quality test questions.

TASK: Generate ${questionCount} exceptional test questions based on the provided content.

CONTENT TO ANALYZE:
${content.substring(0, 8000)}

PARAMETERS:
- Difficulty Level: ${difficulty}
- Question Types: ${questionTypes.join(', ')}
- Total Questions: ${questionCount}
${subject ? `- Subject Area: ${subject}` : ''}
${focus ? `- Focus Area: ${focus}` : ''}

CRITICAL REQUIREMENTS:
1. Each question MUST be directly answerable from the provided content
2. Include the exact source sentence that supports the correct answer
3. For multiple-choice: Create 4 options with 1 clearly correct answer and 3 plausible but incorrect distractors
4. For true-false: Ensure statements are unambiguous and clearly true or false based on content
5. Provide detailed explanations that reference specific parts of the content
6. Assign appropriate point values (1-3) based on question difficulty
7. Ensure cognitive diversity: include recall, comprehension, application, and analysis questions
8. Avoid questions that require external knowledge not present in the content

${isTrueFalse ? 'For true-false questions: Use options ["True", "False"] and make correctAnswer either "True" or "False".' : ''}
${isMultipleChoice ? 'For multiple-choice questions: Use exactly 4 options and make correctAnswer match one of the options exactly.' : ''}

OUTPUT FORMAT (JSON):
{
  "questions": [
    {
      "id": "q_001",
      "type": "${isTrueFalse ? 'true-false' : 'multiple-choice'}",
      "question": "Clear, specific question text",
      ${isMultipleChoice ? '"options": ["Option A", "Option B", "Option C", "Option D"],' : '"options": ["True", "False"],'}
      "correctAnswer": "${isMultipleChoice ? 'Option A' : 'True'}",
      "explanation": "Detailed explanation referencing specific content",
      "difficulty": "${difficulty}",
      "points": ${difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3},
      "sourceText": "Exact sentence from content that supports the answer",
      "confidence": 0.95
    }
  ]
}

Generate exactly ${questionCount} high-quality questions now:`;

  const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{
          text: prompt
        }]
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 2048,
      }
    })
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!generatedText) {
    throw new Error('No response from Gemini API');
  }

  try {
    // Extract JSON from the response
    const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response');
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const questions = parsed.questions || [];

    // Process and validate questions
    const processedQuestions = questions.map((q: any, index: number) => ({
      id: q.id || `q_${String(index + 1).padStart(3, '0')}`,
      type: q.type || (isTrueFalse ? 'true-false' : 'multiple-choice'),
      question: q.question || 'Generated question',
      options: q.options || (isTrueFalse ? ['True', 'False'] : ['Option A', 'Option B', 'Option C', 'Option D']),
      correctAnswer: q.correctAnswer || (isTrueFalse ? 'True' : 'Option A'),
      explanation: q.explanation || 'No explanation provided',
      difficulty: q.difficulty || difficulty,
      points: q.points || (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3),
      sourceText: q.sourceText || 'Generated from your content',
      confidence: q.confidence || 0.8
    }));

    const estimatedTime = processedQuestions.length * (difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3);

    return {
      questions: processedQuestions,
      metadata: {
        totalQuestions: processedQuestions.length,
        estimatedTime,
        difficulty,
        subject,
        contentHash: generateContentHash(request)
      }
    };

  } catch (parseError) {
    console.error('Failed to parse Gemini response:', parseError);
    throw new Error('Invalid response format from AI');
  }
}

function generateMockQuestions(request: GenerateQuestionsRequest): AIResponse {
  const { questionCount, difficulty, questionTypes } = request;
  const questions: GeneratedQuestion[] = [];
  
  const isTrueFalse = questionTypes.includes('true-false');
  
  for (let i = 0; i < questionCount; i++) {
    if (isTrueFalse) {
      questions.push({
        id: `mock_${i + 1}`,
        type: 'true-false',
        question: `Sample true/false question ${i + 1} based on your content`,
        options: ['True', 'False'],
        correctAnswer: i % 2 === 0 ? 'True' : 'False',
        explanation: 'This is a sample explanation for the mock true/false question.',
        difficulty,
        points: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3,
        sourceText: 'Mock source text from your document',
        confidence: 0.5
      });
    } else {
      questions.push({
        id: `mock_${i + 1}`,
        type: 'multiple-choice',
        question: `Sample multiple choice question ${i + 1} based on your content`,
        options: ['Option A', 'Option B', 'Option C', 'Option D'],
        correctAnswer: 'Option A',
        explanation: 'This is a sample explanation for the mock multiple choice question.',
        difficulty,
        points: difficulty === 'easy' ? 1 : difficulty === 'medium' ? 2 : 3,
        sourceText: 'Mock source text from your document',
        confidence: 0.5
      });
    }
  }

  return {
    questions,
    metadata: {
      totalQuestions: questionCount,
      estimatedTime: questionCount * 2,
      difficulty,
      subject: request.subject || 'General',
      contentHash: 'mock_hash'
    }
  };
}

function generateContentHash(request: GenerateQuestionsRequest): string {
  const hashInput = `${request.content}-${request.difficulty}-${request.questionCount}-${request.questionTypes.join(',')}`;
  // Simple hash function for demo purposes
  let hash = 0;
  for (let i = 0; i < hashInput.length; i++) {
    const char = hashInput.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(16);
}