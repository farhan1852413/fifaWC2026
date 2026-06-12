import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout, Card, Button } from '../components';
import { useAuth } from '../hooks/useAuth';
import { runScoreUpdate } from '../services/adminService';

export const Admin = () => {
  const { userData } = useAuth();
  const navigate = useNavigate();
  const [running, setRunning] = React.useState(false);
  const [result, setResult] = React.useState<{ scoresUpdated: number; pointsUpdated: number; usersUpdated: number } | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [lastRun, setLastRun] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (userData && !userData.admin) void navigate('/');
  }, [userData, navigate]);

  if (!userData?.admin) return null;

  const handleUpdate = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await runScoreUpdate();
      setResult(res);
      setLastRun(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setRunning(false);
    }
  };

  return (
    <AppLayout>
      <div className="flex items-center justify-center px-4 py-8">
        <Card className="p-6 max-w-md w-full">
          <h1 className="text-xl font-bold text-white mb-2 text-center">Admin Panel</h1>
          <p className="text-white/50 text-sm text-center mb-6">Manually sync scores and recalculate points</p>

          <Button onClick={() => void handleUpdate()} disabled={running} className="w-full">
            {running ? 'Updating...' : '🔄 Update Scores & Points'}
          </Button>

          {lastRun && (
            <p className="text-white/40 text-xs text-center mt-3">
              Last run: {lastRun.toLocaleTimeString()}
            </p>
          )}

          {result && (
            <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <p className="text-green-400 text-sm font-medium mb-2">✓ Update complete</p>
              <div className="text-white/70 text-sm space-y-1">
                <p>Scores updated: {result.scoresUpdated}</p>
                <p>Predictions recalculated: {result.pointsUpdated}</p>
                <p>User scores updated: {result.usersUpdated}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">✗ {error}</p>
            </div>
          )}
        </Card>
      </div>
    </AppLayout>
  );
};