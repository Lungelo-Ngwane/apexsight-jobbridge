import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { JSX } from 'react';
import { CircularLoader } from "@/app/components/ui/circular-loader";
// import { useAuth } from '@/context/AuthContext';

export default function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[40vh] flex items-center justify-center">
        <CircularLoader size="md" label="Loading..." />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" />;

  return children;
}
