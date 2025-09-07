import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessNotesRequest {
  content?: string;
  fileData?: string;
  fileName?: string;
  fileType?: string;
}

interface ProcessedContent {
  text: string;
  title: string;
  topics: string[];
  summary: string;
  wordCount: number;
  estimatedReadingTime: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      throw new Error('Gemini API key not configured');
    }

    const { content, fileData, fileName, fileType }: ProcessNotesRequest = await req.json();
    
    let textContent = '';
    
    // Extract text based on input type
    if (content) {
      textContent = content;
    } else if (fileData && fileType) {
      // For now, assume text files. In production, you'd want proper file processing
      if (fileType.includes('text') || fileType.includes('markdown')) {
        textContent = atob(fileData); // Decode base64
      } else {
        throw new Error(`Unsupported file type: ${fileType}`);
      }
    } else {
      throw new Error('No content or file provided');
    }

    if (!textContent.trim()) {
      throw new Error('No text content found');
    }

    // Process with Gemini AI
    const processed = await processWithGemini(textContent, geminiApiKey, fileName);
    
    return new Response(JSON.stringify(processed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-notes function:', error);
    return new Response(JSON.stringify({ 
      error: error.message,
      fallback: generateFallbackProcessing(await req.json())
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function processWithGemini(text: string, apiKey: string, fileName?: string): Promise<ProcessedContent> {
  const prompt = `You are an expert content analyzer and educational assistant. Analyze the following text and extract key information for creating study materials.

TEXT CONTENT:
${text.substring(0, 8000)} // Limit to avoid token limits

TASK: Extract and provide the following information in JSON format:

1. TITLE: Generate a clear, descriptive title for this content (use filename as hint if provided: ${fileName || 'N/A'})
2. TOPICS: Identify 3-8 key topics/concepts covered in the text
3. SUMMARY: Write a 2-3 sentence summary of the main points
4. WORD_COUNT: Approximate word count
5. READING_TIME: Estimated reading time in minutes

Requirements:
- Topics should be specific concepts that can be tested
- Title should be academic/professional style
- Summary should capture the essence without being too long
- Be concise but comprehensive

Return ONLY valid JSON in this format:
{
  "title": "Clear descriptive title",
  "topics": ["Topic 1", "Topic 2", "Topic 3"],
  "summary": "Brief but comprehensive summary of the content.",
  "wordCount": 500,
  "estimatedReadingTime": 3
}`;

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
        temperature: 0.3,
        topK: 40,
        topP: 0.8,
        maxOutputTokens: 1024,
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
    
    return {
      text,
      title: parsed.title || 'Untitled Study Material',
      topics: Array.isArray(parsed.topics) ? parsed.topics : [],
      summary: parsed.summary || 'No summary available',
      wordCount: parsed.wordCount || Math.ceil(text.split(' ').length),
      estimatedReadingTime: parsed.estimatedReadingTime || Math.ceil(text.split(' ').length / 200)
    };

  } catch (parseError) {
    console.error('Failed to parse Gemini response:', parseError);
    throw new Error('Invalid response format from AI');
  }
}

function generateFallbackProcessing(request: ProcessNotesRequest): ProcessedContent {
  const text = request.content || '';
  const words = text.split(/\s+/).filter(w => w.length > 0);
  
  // Simple fallback processing
  const title = request.fileName?.replace(/\.[^/.]+$/, "") || 'Study Material';
  const topics = extractSimpleTopics(text);
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

function extractSimpleTopics(text: string): string[] {
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