import { db } from '../firebase';
import {
  ref,
  get,
  set,
  update,
  remove,
  query,
  limitToFirst,
  onValue,
} from 'firebase/database';
import type { User } from 'firebase/auth';

export interface UserData {
  email: string;
  displayName: string;
  userName: string;
  photoURL: string;
  score: number;
  admin: boolean;
}

export const RESERVED_USERNAMES = [
  'about',
  'leaderboard',
  'rules',
  'edit-profile',
  'editprofile',
  'admin',
  'api',
  'settings',
  'login',
  'signin',
  'signup',
  'register',
  'logout',
  'signout',
  'profile',
  'user',
  'users',
  'club',
  'clubs',
  'league',
  'leagues',
];

/**
 * Normalize username for uniqueness checking (Gmail-style)
 * Removes all dots since they're ignored for uniqueness
 */
export const normalizeUsername = (userName: string): string => {
  return userName.toLowerCase().replace(/\./g, '');
};

/**
 * Check if a username is reserved (route names, system words)
 */
export const isReservedUsername = (userName: string): boolean => {
  return RESERVED_USERNAMES.includes(normalizeUsername(userName));
};

/**
 * Sanitize username input - allows dots but removes invalid characters
 * and prevents leading/trailing/consecutive dots
 */
export const sanitizeUsername = (input: string): string => {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '') // Allow dots
    .replace(/\.{2,}/g, '.') // Replace consecutive dots with single dot
    .replace(/^\./, '') // Remove leading dot
    .replace(/\.$/, ''); // Remove trailing dot
};

export const handleUserLogin = async (user: User) => {
  const userRef = ref(db, `users/${user.uid}`);
  const snapshot = await get(userRef);

  if (!snapshot.exists()) {
    // Check if this is the first user to make them admin
    const firstUserFlagRef = ref(db, 'meta/firstUserClaimed');
    const firstUserFlagSnapshot = await get(firstUserFlagRef);
    const isFirstUser = !firstUserFlagSnapshot.exists();
    if (isFirstUser) {
  await set(firstUserFlagRef, true);
}

    // Generate a unique username
    const baseUserName = user.email ? user.email.split('@')[0] : 'user';
    const userName = await generateUniqueUsername(baseUserName);

    const userData: UserData = {
      email: user.email || '',
      displayName: user.displayName || '',
      userName,
      photoURL: user.photoURL || '',
      score: 0,
      admin: isFirstUser,
    };

    // Save user data and claim username atomically (store normalized version in index)
    await set(userRef, userData);
    await set(ref(db, `usernames/${normalizeUsername(userName)}`), user.uid);

    return userData;
  }

  return snapshot.val() as UserData;
};

/**
 * Check if a username is available (Gmail-style: dots are ignored)
 * @param userName - The username to check
 * @param currentUid - Optional: current user's UID (to allow keeping their own username)
 * @returns true if available, false if taken
 */
export const checkUsernameAvailable = async (
  userName: string,
  currentUid?: string
): Promise<boolean> => {
  const normalized = normalizeUsername(userName);
  if (!normalized || normalized.length < 3) return false;

  // Check if username is reserved
  if (RESERVED_USERNAMES.includes(normalized)) return false;

  const usernameRef = ref(db, `usernames/${normalized}`);
  const snapshot = await get(usernameRef);

  if (!snapshot.exists()) return true;

  // If it's the current user's username, it's "available" for them
  if (currentUid && snapshot.val() === currentUid) return true;

  return false;
};

/**
 * Generate a unique username by appending numbers if needed
 */
const generateUniqueUsername = async (
  baseUserName: string
): Promise<string> => {
  let userName = sanitizeUsername(baseUserName);
  let suffix = 0;

  while (!(await checkUsernameAvailable(userName))) {
    suffix++;
    userName = `${sanitizeUsername(baseUserName)}${suffix}`;
  }

  return userName;
};

export const updateUserProfile = async (
  uid: string,
  data: { userName: string; displayName: string; photoURL?: string },
  oldUserName?: string
) => {
  const newUserName = sanitizeUsername(data.userName);
  const normalizedNew = normalizeUsername(newUserName);
  const normalizedOld = oldUserName ? normalizeUsername(oldUserName) : '';

  if (normalizedOld && normalizedOld !== normalizedNew) {
    if (isReservedUsername(newUserName)) {
      throw new Error('Username is reserved');
    }
    const isAvailable = await checkUsernameAvailable(newUserName, uid);
    if (!isAvailable) {
      throw new Error('Username is already taken');
    }

    await remove(ref(db, `usernames/${normalizedOld}`));
    await set(ref(db, `usernames/${normalizedNew}`), uid);
  }

  const userRef = ref(db, `users/${uid}`);
  await update(userRef, {
    userName: newUserName,
    displayName: data.displayName,
    ...(data.photoURL !== undefined && { photoURL: data.photoURL }),
  });
};

/**
 * Get a user by their username
 * Returns the user data and their ID
 */
export const getUserByUsername = async (
  userName: string
): Promise<{ id: string; data: UserData } | null> => {
  const normalized = normalizeUsername(userName);
  const usernameRef = ref(db, `usernames/${normalized}`);
  const snapshot = await get(usernameRef);

  if (!snapshot.exists()) return null;

  const userId = snapshot.val() as string;
  const userRef = ref(db, `users/${userId}`);
  const userSnapshot = await get(userRef);

  if (!userSnapshot.exists()) return null;

  return {
    id: userId,
    data: userSnapshot.val() as UserData,
  };
};

/**
 * Upload a profile picture to Firebase Storage
 * @param uid - User's UID
 * @param file - Image file to upload
 * @returns Download URL of the uploaded image
 */
export const uploadProfilePicture = async (
  uid: string,
  avatarUrl: string
): Promise<string> => {
  const userRef = ref(db, `users/${uid}`);

  await update(userRef, {
    photoURL: avatarUrl,
  });

  return avatarUrl;
};

export interface UserWithId extends UserData {
  id: string;
}

/**
 * Subscribe to all users with real-time updates, sorted by score descending.
 */
export const subscribeToLeaderboard = (
  callback: (users: UserWithId[]) => void
): (() => void) => {
  const usersRef = ref(db, 'users');
  const unsubscribe = onValue(usersRef, (snapshot) => {
    const data = snapshot.val() as Record<string, UserData> | null;
    if (!data) {
      callback([]);
      return;
    }
    const users: UserWithId[] = Object.entries(data).map(([id, user]) => ({
      id,
      ...user,
    }));
    // Sort by score descending
    users.sort((a, b) => b.score - a.score);
    callback(users);
  });
  return unsubscribe;
};

/**
 * Delete a user account and all associated data
 * Removes: user data, username claim, predictions, league memberships
 */
export const deleteUserAccount = async (
  uid: string,
  userName: string
): Promise<void> => {
  const normalizedUsername = normalizeUsername(userName);

  // Get user's leagues to leave them
  const userLeaguesRef = ref(db, `userLeagues/${uid}`);
  const userLeaguesSnapshot = await get(userLeaguesRef);

  if (userLeaguesSnapshot.exists()) {
    const leagueIds = Object.keys(
      userLeaguesSnapshot.val() as Record<string, boolean>
    );

    // Leave all leagues (remove from leagueMembers)
    for (const leagueId of leagueIds) {
      await remove(ref(db, `leagueMembers/${leagueId}/${uid}`));
    }

    // Remove userLeagues entry
    await remove(userLeaguesRef);
  }

  // Remove all predictions
  await remove(ref(db, `predictions/${uid}`));

  // Remove username claim
  await remove(ref(db, `usernames/${normalizedUsername}`));

  // Remove user data
  await remove(ref(db, `users/${uid}`));
};
