import React from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import {
  AppLayout,
  Card,
  Button,
  
  ProfilePicture,
  useConfirm,
} from '../components';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  checkUsernameAvailable,
  deleteUserAccount,
  getLeaguesOwnedByUser,
  isReservedUsername,
  sanitizeUsername,
  updateUserProfile,
} from '../services';

const AVATARS = [
  { id: 'ronaldo', src: '/avatars/ronaldo.png', label: 'Ronaldo' },
  { id: 'messi', src: '/avatars/messi.png', label: 'Messi' },
  { id: 'neymar', src: '/avatars/neymar.png', label: 'Neymar' },
  { id: 'modric', src: '/avatars/modric.png', label: 'Modric' },
  { id: 'saka', src: '/avatars/saka.png', label: 'Saka' },
  { id: 'musiala', src: '/avatars/musiala.png', label: 'Musiala' },
];

export const EditProfile = () => {
  const navigate = useNavigate();
  const { user, userData, setUserData } = useAuth();
  const { showToast } = useToast();
  const { showConfirm, ConfirmDialogComponent } = useConfirm();

  const [userName, setUserName] = React.useState(userData?.userName ?? '');
  const [displayName, setDisplayName] = React.useState(userData?.displayName ?? '');
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [selectedAvatar, setSelectedAvatar] = React.useState('/avatars/ronaldo.png');
  const [usernameStatus, setUsernameStatus] = React.useState<
  'idle' | 'checking' | 'available' | 'taken' | 'reserved'
>('idle');

  const originalUserName = userData?.userName ?? '';

  React.useEffect(() => {
    setUserName(userData?.userName ?? '');
    setDisplayName(userData?.displayName ?? '');
    setSelectedAvatar(userData?.photoURL ?? '/avatars/ronaldo.png');
  }, [userData?.userName, userData?.displayName, userData?.photoURL]);

  React.useEffect(() => {
    if (userName === originalUserName) {
      setUsernameStatus('idle');
      return;
    }

    if (userName.length < 3) {
      setUsernameStatus('idle');
      return;
    }

    if (isReservedUsername(userName)) {
      setUsernameStatus('reserved');
      return;
    }

    setUsernameStatus('checking');

    const timeoutId = setTimeout(() => {
      checkUsernameAvailable(userName, user?.uid)
        .then((available) => {
          setUsernameStatus(available ? 'available' : 'taken');
        })
        .catch(() => setUsernameStatus('idle'));
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [userName, originalUserName, user?.uid]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (usernameStatus === 'taken' || usernameStatus === 'reserved') return;

    const finalUserName = sanitizeUsername(userName);

    setSaving(true);
    setError(null);

    try {
      await updateUserProfile(
        user.uid,
        { userName: finalUserName, displayName, photoURL: selectedAvatar },
        originalUserName
      );

      if (userData) {
        setUserData({
          ...userData,
          userName: finalUserName,
          displayName,
          photoURL: selectedAvatar,
        });
      }

      navigate(`/${finalUserName}`);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || !userData) return;

    const ownedLeagues = await getLeaguesOwnedByUser(user.uid);

    if (ownedLeagues.length > 0) {
      showToast('Delete or transfer leagues first', 'error');
      return;
    }

    const confirmed = await showConfirm({
      title: 'Delete Account',
      message: 'This action cannot be undone.',
      confirmText: 'Delete',
    });

    if (!confirmed) return;

    setDeleting(true);

    try {
      await deleteUserAccount(user.uid, userData.userName);
      await signOut(auth);
      navigate('/', { replace: true });
    } catch (err) {
      showToast('Failed to delete account', 'error');
      setDeleting(false);
    }
  };

  const isFormValid =
    userName.length >= 3 &&
    usernameStatus !== 'taken' &&
    usernameStatus !== 'reserved' &&
    usernameStatus !== 'checking';

  return (
    <AppLayout>
      <div className="flex items-center justify-center px-4 py-8">
        <Card className="p-6 max-w-md w-full">
          <h1 className="text-xl font-bold text-white mb-6 text-center">
            Edit Profile
          </h1>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">

            {/* Current Avatar Preview */}
            <div className="flex flex-col items-center gap-4">
              <ProfilePicture
                src={selectedAvatar}
                name={userData?.displayName}
                size="xl"
              />

              {/* Avatar Picker */}
              <div className="grid grid-cols-6 gap-2 w-full">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    type="button"
                    onClick={() => setSelectedAvatar(avatar.src)}
                    className={`w-16 h-16 relative rounded-full overflow-hidden border-2 transition-all ${
                      selectedAvatar === avatar.src
                        ? 'border-white scale-110'
                        : 'border-white/20 hover:border-white/50'
                    }`}
                    title={avatar.label}
                  >
                    <img
                      src={avatar.src}
                      alt={avatar.label}
                      className="w-full h-full object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Display Name */}
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Display name"
              className="input"
              required
            />

            {/* Username */}
            <input
              value={userName}
              onChange={(e) =>
                setUserName(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9._-]/g, '')
                    .replace(/^\./, '')
                )
              }
              placeholder="username"
              className="input"
              minLength={3}
              required
            />

            {usernameStatus === 'taken' && (
              <p className="text-red-400 text-sm">Username already taken</p>
            )}
            {usernameStatus === 'reserved' && (
              <p className="text-red-400 text-sm">Username is reserved</p>
            )}
            {error && <p className="text-red-400 text-sm">{error}</p>}

            <Button type="submit" disabled={saving || !isFormValid}>
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>

          </form>

          <button
            onClick={() => void handleDeleteAccount()}
            disabled={deleting}
            className="text-red-500 text-sm mt-6"
          >
            {deleting ? 'Deleting...' : 'Delete Account'}
          </button>
        </Card>
      </div>

      {ConfirmDialogComponent}
    </AppLayout>
  );
};