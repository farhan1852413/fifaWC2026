import React from 'react';
import { type User, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebase';
import {
  handleUserLogin,
  joinLeague,
  isLeagueMember,
  type UserData,
} from '../services';
import { AuthContext } from './AuthContext';

const JOIN_INTENT_KEY = 'pendingJoinLeague';

type JoinIntent = {
  leagueId: string;
  slug: string;
  inviteCode: string;
};

const getJoinIntent = (): JoinIntent | null => {
  const stored = localStorage.getItem(JOIN_INTENT_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as JoinIntent;
  } catch {
    return null;
  }
};

const clearJoinIntent = (): void => {
  localStorage.removeItem(JOIN_INTENT_KEY);
};

const PENDING_LEAGUE_KEY = 'pendingSelectedLeague';

export const setPendingSelectedLeague = (leagueId: string): void => {
  localStorage.setItem(PENDING_LEAGUE_KEY, leagueId);
};

export const getPendingSelectedLeague = (): string | null => {
  return localStorage.getItem(PENDING_LEAGUE_KEY);
};

export const clearPendingSelectedLeague = (): void => {
  localStorage.removeItem(PENDING_LEAGUE_KEY);
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = React.useState<User | null>(null);
  const [userData, setUserData] = React.useState<UserData | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (!currentUser) {
        setUserData(null);
        setLoading(false);
        return;
      }

      try {
        // 🔥 IMPORTANT FIX: ensure Firebase auth token is ready
        await currentUser.getIdToken();

        // Load/create user in DB
        const data = await handleUserLogin(currentUser);
        setUserData(data);

        // Handle pending league join
        const joinIntent = getJoinIntent();

        if (joinIntent) {
          try {
            const alreadyMember = await isLeagueMember(
              joinIntent.leagueId,
              currentUser.uid
            );

            if (!alreadyMember) {
              await joinLeague(joinIntent.leagueId, currentUser.uid);
            }

            setPendingSelectedLeague(joinIntent.leagueId);
            window.location.href = `/league/${joinIntent.slug}`;
          } catch (err) {
            console.error('Error processing join intent:', err);
          } finally {
            clearJoinIntent();
          }
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
        if (error instanceof Error) {
    console.error('Message:', error.message);
    console.error('Stack:', error.stack);
  }
        setUserData(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const value = {
    user,
    userData,
    loading,
    setUserData,
  };

  return (
    <AuthContext value={value}>
      {!loading && children}
    </AuthContext>
  );
};