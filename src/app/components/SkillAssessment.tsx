import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import { Card } from "@/app/components/ui/card";
import { Progress } from "@/app/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import { Label } from "@/app/components/ui/label";
import { 
  Clock,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Flag,
  AlertCircle
} from "lucide-react";

interface SkillAssessmentProps {
  onComplete: () => void;
  onBack: () => void;
}

export function SkillAssessment({ onComplete, onBack }: SkillAssessmentProps) {
  const [currentQuestion, setCurrentQuestion] = useState(1);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const totalQuestions = 20;
  const timeRemaining = "24:35";
  
  const questions = [
    {
      id: 1,
      question: "Which of the following best describes the purpose of data normalization in database design?",
      options: [
        "To increase data redundancy for backup purposes",
        "To organize data to reduce redundancy and improve data integrity",
        "To encrypt sensitive information",
        "To improve query performance by creating indexes"
      ]
    },
    {
      id: 2,
      question: "In Python, what is the primary difference between a list and a tuple?",
      options: [
        "Lists are ordered, tuples are unordered",
        "Lists are mutable, tuples are immutable",
        "Lists can store multiple data types, tuples cannot",
        "There is no difference"
      ]
    }
  ];

  const currentQ = questions[currentQuestion - 1];
  const progress = (currentQuestion / totalQuestions) * 100;

  const handleNext = () => {
    if (currentQuestion < totalQuestions) {
      setCurrentQuestion(currentQuestion + 1);
      setSelectedAnswer("");
    } else {
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 1) {
      setCurrentQuestion(currentQuestion - 1);
      setSelectedAnswer("");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Assessment Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Data Analysis Assessment</h1>
              <p className="text-sm text-gray-600">Intermediate Level</p>
            </div>
            
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 bg-blue-50 px-4 py-2 rounded-lg">
                <Clock className="w-4 h-4 text-blue-600" />
                <span className="font-mono font-semibold text-blue-600">{timeRemaining}</span>
              </div>
              <Button variant="outline" size="sm">
                <Flag className="w-4 h-4 mr-2" />
                Pause
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Question {currentQuestion} of {totalQuestions}</span>
              <span>{Math.round(progress)}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        </div>
      </div>

      {/* Assessment Content */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Question Area */}
          <div className="lg:col-span-3">
            <Card className="p-8 border-gray-200 mb-6">
              <div className="mb-6">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <span className="font-medium">Question {currentQuestion}</span>
                  <span className="text-gray-400">•</span>
                  <span>Multiple Choice</span>
                </div>
                
                <h2 className="text-xl font-medium text-gray-900 leading-relaxed">
                  {currentQ.question}
                </h2>
              </div>

              <RadioGroup value={selectedAnswer} onValueChange={setSelectedAnswer}>
                <div className="space-y-3">
                  {currentQ.options.map((option, index) => (
                    <div key={index}>
                      <Label
                        htmlFor={`option-${index}`}
                        className={`flex items-start gap-4 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                          selectedAnswer === `option-${index}`
                            ? 'border-blue-600 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300 bg-white'
                        }`}
                      >
                        <RadioGroupItem
                          value={`option-${index}`}
                          id={`option-${index}`}
                          className="mt-0.5"
                        />
                        <div className="flex-1">
                          <span className={`text-sm font-medium mr-2 ${
                            selectedAnswer === `option-${index}` ? 'text-blue-900' : 'text-gray-700'
                          }`}>
                            {String.fromCharCode(65 + index)}.
                          </span>
                          <span className={selectedAnswer === `option-${index}` ? 'text-gray-900' : 'text-gray-700'}>
                            {option}
                          </span>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </RadioGroup>

              {/* Info Banner */}
              <div className="mt-6 flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-amber-900">
                  <p className="font-medium mb-1">Assessment Tip</p>
                  <p className="text-amber-800">
                    Take your time to read each question carefully. You can flag questions to review later.
                  </p>
                </div>
              </div>
            </Card>

            {/* Navigation */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handlePrevious}
                disabled={currentQuestion === 1}
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              <div className="flex items-center gap-3">
                <Button variant="ghost">
                  <Flag className="w-4 h-4 mr-2" />
                  Flag for Review
                </Button>
                
                <Button
                  onClick={handleNext}
                  disabled={!selectedAnswer}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {currentQuestion === totalQuestions ? 'Submit Assessment' : 'Next Question'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>

          {/* Sidebar - Question Navigator */}
          <div className="lg:col-span-1">
            <Card className="p-4 border-gray-200 sticky top-24">
              <h3 className="font-semibold text-gray-900 mb-4">Question Navigator</h3>
              
              <div className="grid grid-cols-4 gap-2 mb-6">
                {Array.from({ length: totalQuestions }, (_, i) => i + 1).map((num) => (
                  <button
                    key={num}
                    onClick={() => setCurrentQuestion(num)}
                    className={`aspect-square rounded-md text-sm font-medium transition-all ${
                      num === currentQuestion
                        ? 'bg-blue-600 text-white'
                        : num < currentQuestion
                        ? 'bg-green-100 text-green-700 border border-green-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-blue-600 rounded"></div>
                  <span className="text-gray-700">Current</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-green-100 border border-green-300 rounded"></div>
                  <span className="text-gray-700">Answered</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 bg-gray-100 rounded"></div>
                  <span className="text-gray-700">Not answered</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm mb-2">
                  <span className="text-gray-600">Answered:</span>
                  <span className="font-semibold text-gray-900">{currentQuestion - 1}/{totalQuestions}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Flagged:</span>
                  <span className="font-semibold text-gray-900">0</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
