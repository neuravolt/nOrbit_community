import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, ArrowRight, RotateCcw } from "lucide-react";

interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizComponentProps {
  questions: QuizQuestion[];
  onSubmit: (score: number) => void;
  passThreshold?: number;
}

export function QuizComponent({ questions, onSubmit, passThreshold = 70 }: QuizComponentProps) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [isReviewMode, setIsReviewMode] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const currentQuestion = questions[currentIdx];
  const selectedOption = selectedAnswers[currentIdx];

  const handleSelectOption = (optIdx: number) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [currentIdx]: optIdx,
    });
  };

  const handleNext = () => {
    if (currentIdx < questions.length - 1) {
      setCurrentIdx(currentIdx + 1);
    } else {
      setIsReviewMode(true);
    }
  };

  const handlePrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx(currentIdx - 1);
    }
  };

  const calculateScore = () => {
    let correctCount = 0;
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === q.correctAnswer) {
        correctCount++;
      }
    });
    const finalScore = Math.round((correctCount / questions.length) * 100);
    setScore(finalScore);
    setIsSubmitted(true);
    setIsReviewMode(false);
    onSubmit(finalScore);
  };

  const handleRetry = () => {
    setCurrentIdx(0);
    setSelectedAnswers({});
    setIsReviewMode(false);
    setIsSubmitted(false);
    setScore(0);
  };

  if (isSubmitted) {
    const passed = score >= passThreshold;
    return (
      <Card className="border border-slate-200 bg-white p-6 space-y-6 text-center">
        <h3 className="font-extrabold text-xl text-slate-950">Quiz Performance Report</h3>
        <div className="space-y-2">
          <div className="text-6xl font-extrabold text-slate-900">{score}%</div>
          <Badge className={passed ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-50" : "bg-red-50 text-red-700 border-red-200 hover:bg-red-50"}>
            {passed ? "PASSED CHALLENGE" : "FAILED (THRESHOLD 70%)"}
          </Badge>
        </div>

        {/* Per-question breakdown */}
        <div className="text-left space-y-4 max-h-60 overflow-y-auto bg-slate-50 p-4 border border-slate-200 rounded-xl">
          {questions.map((q, idx) => {
            const studentAns = selectedAnswers[idx];
            const isCorrect = studentAns === q.correctAnswer;

            return (
              <div key={idx} className="border-b border-slate-200 pb-3 last:border-0 last:pb-0">
                <span className="font-bold text-xs flex items-center gap-1">
                  {isCorrect ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <XCircle className="w-4 h-4 text-rose-600" />}
                  Question {idx + 1}
                </span>
                <p className="text-xs font-semibold text-slate-700 mt-1">{q.question}</p>
                <p className="text-[10px] text-slate-400 mt-1 font-mono">Explanation: {q.explanation}</p>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2 justify-center pt-4">
          {!passed && (
            <Button onClick={handleRetry} className="w-full flex items-center justify-center gap-1.5">
              <RotateCcw className="w-4 h-4" /> Retry Quiz
            </Button>
          )}
        </div>
      </Card>
    );
  }

  if (isReviewMode) {
    return (
      <Card className="border border-slate-200 bg-white p-6 space-y-6">
        <h3 className="font-extrabold text-xl text-slate-950">Review Your Answers</h3>
        <p className="text-sm text-slate-500">Confirm all choices before triggering automated score submission.</p>

        <div className="space-y-4 max-h-80 overflow-y-auto">
          {questions.map((q, idx) => (
            <div key={idx} className="bg-slate-50 p-4 border border-slate-200 rounded-xl space-y-2 text-xs">
              <span className="font-bold block">Question {idx + 1}</span>
              <p className="text-slate-700">{q.question}</p>
              <div className="font-semibold text-slate-900 mt-1">
                Selected option: <span className="font-bold">{q.options[selectedAnswers[idx]] || "No Choice Selected"}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
          <Button variant="outline" onClick={() => setIsReviewMode(false)}>
            Back to Quiz
          </Button>
          <Button onClick={calculateScore} className="bg-slate-900 text-white hover:bg-slate-800">
            Submit Assessment
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border border-slate-200 bg-white p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="font-extrabold text-lg text-slate-900">Quiz Challenge</h3>
        <span className="text-xs font-mono text-slate-400">Q {currentIdx + 1} of {questions.length}</span>
      </div>

      <Progress value={((currentIdx + 1) / questions.length) * 100} className="h-1.5 bg-slate-100" />

      <div className="space-y-4 pt-2">
        <span className="text-xs font-bold text-orange-450 uppercase block">Question</span>
        <h4 className="text-base font-bold text-slate-950 leading-relaxed">{currentQuestion.question}</h4>
      </div>

      <div className="grid grid-cols-1 gap-3 pt-2">
        {currentQuestion.options.map((opt, i) => {
          const isSelected = selectedOption === i;
          return (
            <button
              key={i}
              onClick={() => handleSelectOption(i)}
              className={`w-full text-left p-4 rounded-xl border text-sm font-semibold transition-all ${
                isSelected
                  ? "bg-slate-900 border-slate-900 text-white shadow-md"
                  : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100"
              }`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <div className="flex justify-between items-center pt-6 border-t border-slate-100">
        <Button variant="outline" onClick={handlePrev} disabled={currentIdx === 0}>
          Previous
        </Button>
        <Button onClick={handleNext} disabled={selectedOption === undefined}>
          {currentIdx === questions.length - 1 ? "Review Answers" : "Next Question"}
        </Button>
      </div>
    </Card>
  );
}
