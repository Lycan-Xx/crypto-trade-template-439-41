import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, Brain, Target, TrendingUp, Plus } from "lucide-react";
import { CreateQuizPanel } from "@/components/dashboard/CreateQuizPanel";
import { TestPreview } from "@/components/test/TestPreview";
import { useLibraryStore } from "@/stores";
import type { GeneratedQuestion } from "@/services/aiService";

export default function Dashboard() {
  const [showCreateQuiz, setShowCreateQuiz] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState<{
    config: any;
    notes: string;
    questions: GeneratedQuestion[];
  } | null>(null);

  const { savedTests } = useLibraryStore();

  const handleQuizGenerated = (config: any, notes: string, questions: GeneratedQuestion[]) => {
    setPreviewData({ config, notes, questions });
    setShowCreateQuiz(false);
    setShowPreview(true);
  };

  const handlePreviewClose = () => {
    setShowPreview(false);
    setPreviewData(null);
  };

  if (showPreview && previewData) {
    return (
      <TestPreview 
        config={previewData.config}
        notes={previewData.notes}
        onClose={handlePreviewClose}
      />
    );
  }

  if (showCreateQuiz) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-studywise-gray-900">Create New Quiz</h1>
          <Button 
            variant="outline" 
            onClick={() => setShowCreateQuiz(false)}
          >
            Back to Dashboard
          </Button>
        </div>
        <CreateQuizPanel onQuizGenerated={handleQuizGenerated} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-studywise-gray-900 mb-2">Dashboard</h1>
          <p className="text-studywise-gray-600">Track your learning progress and create new tests</p>
        </div>
        <Button 
          onClick={() => setShowCreateQuiz(true)}
          size="lg"
          className="bg-primary hover:bg-primary/90"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create New Quiz
        </Button>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setShowCreateQuiz(true)}>
          <CardContent className="flex items-center p-6">
            <div className="rounded-full bg-blue-100 p-3 mr-4">
              <Plus className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-studywise-gray-900">Create Quiz</h3>
              <p className="text-sm text-studywise-gray-600">AI-powered question generation</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="flex items-center p-6">
            <div className="rounded-full bg-green-100 p-3 mr-4">
              <BookOpen className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-studywise-gray-900">My Library</h3>
              <p className="text-sm text-studywise-gray-600">View saved tests and materials</p>
            </div>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow cursor-pointer">
          <CardContent className="flex items-center p-6">
            <div className="rounded-full bg-purple-100 p-3 mr-4">
              <Target className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold text-studywise-gray-900">Results</h3>
              <p className="text-sm text-studywise-gray-600">Track your performance</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Tests</CardTitle>
            <BookOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{savedTests.length}</div>
            <p className="text-xs text-muted-foreground">
              +2 from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Score</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">85%</div>
            <p className="text-xs text-muted-foreground">
              +5% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Study Streak</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12 days</div>
            <p className="text-xs text-muted-foreground">
              Keep it up!
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Improvement</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+12%</div>
            <p className="text-xs text-muted-foreground">
              From first test
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Tests</CardTitle>
        </CardHeader>
        <CardContent>
          {savedTests.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <BookOpen className="h-12 w-12 text-studywise-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-studywise-gray-900 mb-2">No quizzes yet</h3>
                <p className="text-studywise-gray-600 mb-6">
                  Create your first AI-powered quiz to get started with personalized learning
                </p>
                <Button onClick={() => setShowCreateQuiz(true)} size="lg">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Quiz
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {savedTests.slice(0, 5).map((test) => (
                <div key={test.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <h4 className="font-medium">{test.title}</h4>
                    <p className="text-sm text-muted-foreground">{test.questionCount} questions</p>
                  </div>
                  <div className="flex items-center gap-4">
                    <Progress value={75} className="w-24" />
                    <span className="text-sm font-medium">75%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}