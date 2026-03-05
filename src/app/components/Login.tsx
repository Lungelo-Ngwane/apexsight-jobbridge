import { useEffect, useState } from 'react';
import { registerUser, loginUser, signInWithGoogle } from '../../lib/auth';
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import { Badge } from "@/app/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/app/components/ui/dialog";
import { FeedbackDialog, useFeedbackDialog } from "@/app/components/ui/feedback-dialog";
import { User, Building2, Mail, Lock, UserCircle2 } from "lucide-react";

interface LoginProps {
  onLoginSuccess: (role?: "candidate" | "employer" | null) => void;
  initialMode?: "login" | "register";
  initialRole?: "candidate" | "employer";
}

export default function Login({
  onLoginSuccess,
  initialMode = "login",
  initialRole = "candidate",
}: LoginProps) {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<'candidate' | 'employer'>('candidate');
  const [company, setCompany] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showVerifyEmailModal, setShowVerifyEmailModal] = useState(false);
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

  useEffect(() => {
    setIsRegister(initialMode === "register");
    setRole(initialRole);
  }, [initialMode, initialRole]);

const handleSubmit = async () => {
  try {
    if (isRegister) {
      await registerUser(email, password, fullName, role, company);
      if (role === "employer") {
        setShowVerifyEmailModal(true);
      } else {
        showFeedback(
          "Registration complete",
          "Your account was created. Please verify your email, then sign in.",
        );
      }

      setIsRegister(false);
      setPassword("");
    } else {
      const result = await loginUser(email, password);
      onLoginSuccess(result?.role ?? null);
    }
  } catch (err: any) {
    console.error("LOGIN / REGISTER FAILED:", err);    
    showFeedback(
      "Sign-in failed",
      err?.message || "We couldn't complete this action. Please check your details and try again.",
    );
  } finally {
  }
};

const handleGoogleSignIn = async () => {
  try {
    setGoogleLoading(true);
    await signInWithGoogle();
  } catch (err: any) {
    setGoogleLoading(false);
    showFeedback(
      "Google sign-in failed",
      err?.message || "We couldn't start Google sign-in. Please try again.",
    );
  }
};

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-5 text-center">
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 mb-3">
          ApexSight Access
        </Badge>
        <h2 className="text-2xl font-bold text-gray-900">
          {isRegister ? "Create your account" : "Welcome back"}
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          {isRegister ? "Join as a candidate or employer" : "Sign in to continue"}
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm space-y-4">
        {isRegister && (
          <>
            <div>
              <Label className="text-xs text-gray-600 mb-2 block">Account Type</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("candidate")}
                  className={`h-10 rounded-md border text-sm font-medium transition flex items-center justify-center gap-2 ${
                    role === "candidate"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <User className="w-4 h-4" />
                  Candidate
                </button>
                <button
                  type="button"
                  onClick={() => setRole("employer")}
                  className={`h-10 rounded-md border text-sm font-medium transition flex items-center justify-center gap-2 ${
                    role === "employer"
                      ? "border-blue-600 bg-blue-50 text-blue-700"
                      : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <Building2 className="w-4 h-4" />
                  Employer
                </button>
              </div>
            </div>

            <div className="relative">
              <UserCircle2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                type="text"
                placeholder="Full Name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="pl-9"
              />
            </div>

            {role === 'employer' && (
              <div className="relative">
                <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <Input
                  type="text"
                  placeholder="Company Name"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
          </>
        )}

        <div className="relative">
          <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="relative">
          <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="pl-9"
          />
        </div>

        <Button onClick={handleSubmit} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
          {isRegister ? 'Create Account' : 'Sign In'}
        </Button>

        {!isRegister && (
          <>
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or continue with</span>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full border-gray-300"
            >
              <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4" aria-hidden="true">
                <path
                  fill="#EA4335"
                  d="M12 10.2v3.9h5.5c-.2 1.3-1.5 3.9-5.5 3.9-3.3 0-6-2.8-6-6.2s2.7-6.2 6-6.2c1.9 0 3.1.8 3.8 1.4l2.6-2.5C16.8 2.9 14.6 2 12 2 6.9 2 2.8 6.3 2.8 11.5S6.9 21 12 21c6.9 0 9.1-4.9 9.1-7.4 0-.5 0-.8-.1-1.2H12z"
                />
              </svg>
              {googleLoading ? "Redirecting..." : "Continue with Google"}
            </Button>
          </>
        )}

        <button
          type="button"
          className="w-full text-sm text-gray-600 hover:text-gray-900 hover:underline"
          onClick={() => setIsRegister(!isRegister)}
        >
          {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Create one"}
        </button>
      </div>

      <Dialog open={showVerifyEmailModal} onOpenChange={setShowVerifyEmailModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify your email to continue</DialogTitle>
            <DialogDescription>
              Your employer account has been created. Please check your inbox and click the
              verification link to continue to onboarding.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setShowVerifyEmailModal(false)}>Okay</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <FeedbackDialog
        open={feedback.open}
        title={feedback.title}
        description={feedback.description}
        onOpenChange={setFeedbackOpen}
      />
    </div>
  );
}

