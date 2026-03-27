import { useEffect, useState } from 'react';
import { checkEmployerInvite, registerUser, loginUser, requestPasswordReset } from '../../lib/auth';
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

