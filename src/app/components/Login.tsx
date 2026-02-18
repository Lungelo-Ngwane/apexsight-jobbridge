import { useEffect, useState } from 'react';
import { registerUser, loginUser } from '../../lib/auth';

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

  useEffect(() => {
    setIsRegister(initialMode === "register");
    setRole(initialRole);
  }, [initialMode, initialRole]);

const handleSubmit = async () => {

  try {
    if (isRegister) {
      await registerUser(email, password, fullName, role, company);
      alert('Registered successfully. You can now login.');
      // ...
    } else {
      const result = await loginUser(email, password);
      onLoginSuccess(result?.role ?? null);
    }
  } catch (err: any) {
    console.error("LOGIN / REGISTER FAILED:", err);     // ← this is critical
    alert(err.message || "Something went wrong - check console");
  } finally {
    console.log("handleSubmit FINISHED");
  }
};

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">{isRegister ? 'Register' : 'Login'}</h2>

      {isRegister && (
        <>
          <input
            type="text"
            placeholder="Full Name"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            className="border p-2 rounded"
          />
          <select
            value={role}
            onChange={e => setRole(e.target.value as 'candidate' | 'employer')}
            className="border p-2 rounded"
          >
            <option value="candidate">Candidate</option>
            <option value="employer">Employer</option>
          </select>
          {role === 'employer' && (
            <input
              type="text"
              placeholder="Company Name"
              value={company}
              onChange={e => setCompany(e.target.value)}
              className="border p-2 rounded"
            />
          )}
        </>
      )}

      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        className="border p-2 rounded"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={e => setPassword(e.target.value)}
        className="border p-2 rounded"
      />

      <button
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        {isRegister ? 'Register' : 'Login'}
      </button>

      <button
        className="text-sm text-gray-500 hover:underline"
        onClick={() => setIsRegister(!isRegister)}
      >
        {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
      </button>
    </div>
  );
}
