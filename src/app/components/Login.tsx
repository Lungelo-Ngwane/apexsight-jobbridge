import { useEffect, useState } from 'react';
import { checkEmployerInvite, registerUser, loginUser, requestPasswordReset, signInWithGoogle } from '../../lib/auth';
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
import { User, Building2, Mail, Lock, UserCircle2, Eye, EyeOff } from "lucide-react";

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
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inviteMatched, setInviteMatched] = useState(false);
  const { feedback, showFeedback, setFeedbackOpen } = useFeedbackDialog();

  useEffect(() => {
    setIsRegister(initialMode === "register");
    setRole(initialRole);
  }, [initialMode, initialRole]);

  useEffect(() => {
    setResetEmail(email);
  }, [email]);

  useEffect(() => {
    if (!isRegister || role !== "employer") {
      setInviteMatched(false);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setInviteMatched(false);
      return;
    }

    const timer = window.setTimeout(() => {
      void checkEmployerInvite(normalizedEmail)
        .then(setInviteMatched)
        .catch(() => setInviteMatched(false));
    }, 250);

    return () => window.clearTimeout(timer);
  }, [email, isRegister, role]);

const handleSubmit = async () => {
  try {
    if (!email.trim()) {
      showFeedback("Missing email", "Enter your email address to continue.");
      return;
    }

    if (!password.trim()) {
      showFeedback(
        isRegister ? "Missing password" : "Missing password",
        "Enter your password to continue.",
      );
      return;
    }

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

const handleForgotPassword = async () => {
  try {
    setResetLoading(true);
    await requestPasswordReset(resetEmail);
    setShowForgotPasswordModal(false);
    showFeedback(
      "Reset email sent",
      "Check your inbox for a password reset link.",
    );
  } catch (err: any) {
    showFeedback(
      "Password reset failed",
      err?.message || "We couldn't send the password reset email. Please try again.",
    );
  } finally {
    setResetLoading(false);
  }
};

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="mb-5 text-center">
        <Badge className="bg-blue-100 text-blue-700 border-blue-200 mb-3">
          ApexSight Access
        </Badge>
        <h2 className="text-2xl font-bold text-gray-900">
          {isRegister ? "Create your account" : "Welcome"}
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
                  placeholder={inviteMatched ? "Company Name (optional for invited users)" : "Company Name"}
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}
            {role === "employer" && inviteMatched && (
              <p className="text-xs text-emerald-700">
                This email has a team invite. After signup, you will join the shared employer workspace.
              </p>
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
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="pl-9 pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <Button onClick={handleSubmit} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
          {isRegister ? 'Create Account' : 'Sign In'}
        </Button>

        {!isRegister && (
          <button
            type="button"
            className="w-full text-sm text-blue-600 hover:text-blue-700 hover:underline"
            onClick={() => setShowForgotPasswordModal(true)}
          >
            Forgot Password?
          </button>
        )}

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
              <svg viewBox="0 0 48 48" className="mr-2 h-5 w-5" aria-hidden="true">
                <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303C33.656 32.657 29.24 36 24 36c-6.627 0-12-5.373-12-12S17.373 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.047 6.053 29.275 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.047 6.053 29.275 4 24 4c-7.682 0-14.289 4.337-17.694 10.691z" />
                <path fill="#4CAF50" d="M24 44c5.176 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.143 35.091 26.716 36 24 36c-5.219 0-9.621-3.318-11.283-7.946l-6.52 5.025C9.566 39.556 16.227 44 24 44z" />
                <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.084 5.571h.003l6.19 5.238C37 39.083 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
              </svg>
              {googleLoading ? "Redirecting..." : "Sign in with Google"}
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
      <Dialog open={showForgotPasswordModal} onOpenChange={setShowForgotPasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter the email address linked to your account and we will send you a reset link.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reset-email">Email address</Label>
            <Input
              id="reset-email"
              type="email"
              placeholder="Email address"
              value={resetEmail}
              onChange={(e) => setResetEmail(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForgotPasswordModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleForgotPassword} disabled={resetLoading}>
              {resetLoading ? "Sending..." : "Send Reset Link"}
            </Button>
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

