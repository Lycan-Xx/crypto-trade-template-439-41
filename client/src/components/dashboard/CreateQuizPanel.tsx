import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Upload, 
  FileText, 
  Sparkles, 
  Settings, 
  ChevronDown, 
  X, 
  Plus,
  Eye,
  Play,
  Loader2
} from "lucide-react";
import { aiService, type ProcessedContent, type GeneratedQuestion } from "@/services/aiService";
import { useToast } from "@/hooks/use-toast";

interface CreateQuizPanelProps {
  onQuizGenerated: (config: any, notes: string, questions: GeneratedQuestion[]) => void;
}

export function CreateQuizPanel({ onQuizGenerated }: CreateQuizPanelProps) {
  // State management
  const [step, setStep] = useState<'upload' | 'customize' | 'preview'>('upload');
  const [notes, setNotes] = useState('');
  const [processedContent, setProcessedContent] = useState<ProcessedContent | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [sampleQuestions, setSampleQuestions] = useState<GeneratedQuestion[]>([]);
  const [showCustomize, setShowCustomize] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  
  // Quiz configuration
  const [title, setTitle] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [customTopic, setCustomTopic] = useState('');
  const [questionType, setQuestionType] = useState<'mcq' | 'true-false'>('mcq');
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');

  // Refs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleNotesChange = useCallback(async (value: string) => {
    setNotes(value);
    
    if (value.trim().length > 50) {
      setIsProcessing(true);
      try {
        const processed = await aiService.processNotes({ content: value });
        setProcessedContent(processed);
        setTitle(processed.title);
        setSelectedTopics(processed.topics.slice(0, 5)); // Limit to 5 topics initially
        
        // Generate sample questions
        await generateSampleQuestions(processed.text, processed.topics);
      } catch (error) {
        console.error('Failed to process notes:', error);
        toast({
          title: "Processing failed",
          description: "Using basic text analysis instead.",
          variant: "destructive"
        });
      } finally {
        setIsProcessing(false);
      }
    } else {
      setProcessedContent(null);
      setSampleQuestions([]);
    }
  }, [toast]);

  const generateSampleQuestions = async (content: string, topics: string[]) => {
    try {
      setIsGenerating(true);
      const response = await aiService.generateQuestions({
        content,
        difficulty,
        questionCount: 2, // Just sample questions
        questionTypes: [questionType === 'mcq' ? 'multiple-choice' : 'true-false'],
        subject: title,
        focus: topics.slice(0, 3).join(', ')
      });
      setSampleQuestions(response.questions);
    } catch (error) {
      console.error('Failed to generate sample questions:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    try {
      const processed = await aiService.processFile(file);
      setProcessedContent(processed);
      setNotes(processed.text);
      setTitle(processed.title);
      setSelectedTopics(processed.topics.slice(0, 5));
      
      // Generate sample questions
      await generateSampleQuestions(processed.text, processed.topics);
      
      toast({
        title: "File processed successfully!",
        description: `Extracted ${processed.wordCount} words and identified ${processed.topics.length} topics.`
      });
    } catch (error) {
      console.error('Failed to process file:', error);
      toast({
        title: "File processing failed",
        description: "Please try again or paste text directly.",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    const file = files[0];
    
    if (file) {
      setIsProcessing(true);
      try {
        const processed = await aiService.processFile(file);
        setProcessedContent(processed);
        setNotes(processed.text);
        setTitle(processed.title);
        setSelectedTopics(processed.topics.slice(0, 5));
        
        await generateSampleQuestions(processed.text, processed.topics);
        
        toast({
          title: "File processed successfully!",
          description: `Extracted ${processed.wordCount} words and identified ${processed.topics.length} topics.`
        });
      } catch (error) {
        console.error('Failed to process file:', error);
        toast({
          title: "File processing failed",
          description: "Please try again or paste text directly.",
          variant: "destructive"
        });
      } finally {
        setIsProcessing(false);
      }
    }
  };

  const handleTopicRemove = (topic: string) => {
    setSelectedTopics(prev => prev.filter(t => t !== topic));
  };

  const handleTopicAdd = () => {
    if (customTopic.trim() && !selectedTopics.includes(customTopic.trim())) {
      setSelectedTopics(prev => [...prev, customTopic.trim()]);
      setCustomTopic('');
    }
  };

  const handleGenerateQuiz = async () => {
    if (!processedContent || !title.trim()) {
      toast({
        title: "Please provide content",
        description: "Add notes and ensure they're processed before generating a quiz.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);
    try {
      const config = {
        title,
        topics: selectedTopics.join(', '),
        questionType,
        numberOfQuestions,
        difficulty
      };

      const response = await aiService.generateQuestions({
        content: processedContent.text,
        difficulty,
        questionCount: numberOfQuestions,
        questionTypes: [questionType === 'mcq' ? 'multiple-choice' : 'true-false'],
        subject: title,
        focus: selectedTopics.join(', ')
      });

      onQuizGenerated(config, processedContent.text, response.questions);
      
      toast({
        title: "Quiz generated successfully!",
        description: `Created ${response.questions.length} questions ready for preview.`
      });
    } catch (error) {
      console.error('Failed to generate quiz:', error);
      toast({
        title: "Quiz generation failed",
        description: "Please try again or contact support.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          Create AI-Powered Quiz
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload/Input Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleFileUpload}
              variant="outline"
              className="flex items-center gap-2"
              disabled={isProcessing}
            >
              <Upload className="w-4 h-4" />
              Upload File
            </Button>
            <span className="text-sm text-muted-foreground">or paste your notes below</span>
          </div>

          <div 
            className={`relative border-2 border-dashed rounded-lg p-4 transition-colors ${
              isDragOver ? 'border-primary bg-primary/10' : 'border-muted-foreground/25'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Textarea
              value={notes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Paste your study notes here, or drag and drop a file... AI will automatically extract topics and generate questions!"
              className="min-h-[120px] border-0 bg-transparent resize-none focus-visible:ring-0"
              disabled={isProcessing}
            />
            
            {isDragOver && (
              <div className="absolute inset-0 bg-primary/10 border-2 border-dashed border-primary rounded-lg flex items-center justify-center">
                <div className="text-primary text-center">
                  <FileText className="w-8 h-8 mx-auto mb-2" />
                  <p className="font-medium">Drop your file here</p>
                </div>
              </div>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.doc,.docx,.pdf"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-6 h-6 animate-spin mr-2" />
            <span className="text-sm text-muted-foreground">Processing your content with AI...</span>
          </div>
        )}

        {/* AI-Generated Content */}
        {processedContent && (
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-medium text-sm text-muted-foreground">AI Analysis</h3>
                  <p className="text-xs text-muted-foreground">
                    {processedContent.wordCount} words • {processedContent.estimatedReadingTime} min read
                  </p>
                </div>
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              
              <div className="space-y-3">
                <div>
                  <Label htmlFor="title" className="text-sm font-medium">Quiz Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="mt-1"
                    placeholder="Enter quiz title..."
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium">Detected Topics</Label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedTopics.map((topic) => (
                      <Badge key={topic} variant="secondary" className="flex items-center gap-1">
                        {topic}
                        <X 
                          className="w-3 h-3 cursor-pointer hover:bg-destructive/20 rounded-full" 
                          onClick={() => handleTopicRemove(topic)}
                        />
                      </Badge>
                    ))}
                    <div className="flex items-center gap-2">
                      <Input
                        value={customTopic}
                        onChange={(e) => setCustomTopic(e.target.value)}
                        placeholder="Add topic..."
                        className="w-24 h-7 text-xs"
                        onKeyPress={(e) => e.key === 'Enter' && handleTopicAdd()}
                      />
                      <Button size="sm" variant="ghost" onClick={handleTopicAdd} className="h-7 w-7 p-0">
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sample Questions */}
            {sampleQuestions.length > 0 && (
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Eye className="w-4 h-4 text-primary" />
                  <h3 className="font-medium text-sm">Sample Questions</h3>
                  {isGenerating && <Loader2 className="w-4 h-4 animate-spin" />}
                </div>
                <div className="space-y-3">
                  {sampleQuestions.map((question, index) => (
                    <div key={question.id} className="text-sm">
                      <p className="font-medium mb-1">{index + 1}. {question.question}</p>
                      {question.options && (
                        <div className="ml-4 space-y-1">
                          {question.options.map((option, idx) => (
                            <div key={idx} className={`text-xs ${option === question.correctAnswer ? 'text-green-600 font-medium' : 'text-muted-foreground'}`}>
                              {String.fromCharCode(65 + idx)}. {option} {option === question.correctAnswer && '✓'}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customization Options */}
            <Collapsible open={showCustomize} onOpenChange={setShowCustomize}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4" />
                    Customize Quiz Settings
                  </div>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showCustomize ? 'rotate-180' : ''}`} />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="questionType" className="text-sm font-medium">Question Type</Label>
                    <Select value={questionType} onValueChange={(value: 'mcq' | 'true-false') => setQuestionType(value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mcq">Multiple Choice</SelectItem>
                        <SelectItem value="true-false">True/False</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label htmlFor="difficulty" className="text-sm font-medium">Difficulty</Label>
                    <Select value={difficulty} onValueChange={(value: 'easy' | 'medium' | 'hard') => setDifficulty(value)}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label htmlFor="numberOfQuestions" className="text-sm font-medium">Number of Questions</Label>
                  <div className="flex items-center gap-4 mt-1">
                    <input
                      type="range"
                      id="numberOfQuestions"
                      min="5"
                      max="25"
                      value={numberOfQuestions}
                      onChange={(e) => setNumberOfQuestions(parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <span className="text-sm font-medium w-8">{numberOfQuestions}</span>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Generate Button */}
            <Button 
              onClick={handleGenerateQuiz}
              disabled={isGenerating || !title.trim()}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Generating Quiz...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 mr-2" />
                  Generate Complete Quiz ({numberOfQuestions} questions)
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}