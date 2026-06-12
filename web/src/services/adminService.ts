import { db } from '../firebase';
import { ref, get, update } from 'firebase/database';

const FIFA_COMPETITION_ID = '17';
const FIFA_SEASON_ID = '285023';

interface Match {
  game: number;
  fifaId: string;
  homeScore: number;
  awayScore: number;
}

interface Prediction {
  homePrediction: number;
  awayPrediction: number;
  points: number;
}

interface FifaMatch {
  IdMatch: string;
  Home: { Score: number | null };
  Away: { Score: number | null };
}

const getWinner = (home: number, away: number): 'home' | 'away' | 'tied' => {
  if (home > away) return 'home';
  if (home < away) return 'away';
  return 'tied';
};

const calculatePoints = (
  homeScore: number,
  awayScore: number,
  homePrediction: number,
  awayPrediction: number
): number => {
  if (homeScore < 0) return 0;
  if (homeScore === homePrediction && awayScore === awayPrediction) return 15;
  if (getWinner(homeScore, awayScore) === getWinner(homePrediction, awayPrediction)) {
    const difference = Math.abs(homePrediction - homeScore) + Math.abs(awayPrediction - awayScore);
    return Math.max(0, 10 - difference);
  }
  return 0;
};

export const runScoreUpdate = async (): Promise<{ scoresUpdated: number; pointsUpdated: number; usersUpdated: number }> => {
  // 1. Fetch today's scores from FIFA API
  

  const apiUrl = `https://api.fifa.com/api/v3/calendar/matches?idseason=${FIFA_SEASON_ID}&idcompetition=${FIFA_COMPETITION_ID}&count=500`;
  const response = await fetch(apiUrl);
  if (!response.ok) throw new Error(`FIFA API error: ${response.status}`);
  const text = await response.text();
  console.log('FIFA API raw response:', text.substring(0, 500));
  const data = JSON.parse(text) as { Results: FifaMatch[] };
  console.log('FIFA API results:', data.Results.length);
  console.log('First result:', JSON.stringify(data.Results[0]));

  // 2. Get matches from DB
  const matchesSnapshot = await get(ref(db, 'matches'));
  const matches = matchesSnapshot.val() as Record<string, Match> | null;
  if (!matches) throw new Error('No matches in database');
  console.log('DB matches:', Object.keys(matches).length);
  console.log('First DB match:', JSON.stringify(Object.values(matches)[0]));

  // 3. Update scores
  const scoreUpdates: Record<string, number> = {};
  for (const fifaMatch of data.Results) {
    for (const [gameId, match] of Object.entries(matches)) {
      if (match.fifaId === fifaMatch.IdMatch) {
        const homeScore = fifaMatch.Home?.Score ?? -1;
        const awayScore = fifaMatch.Away?.Score ?? -1;
        if (homeScore >= 0 && match.homeScore !== homeScore) scoreUpdates[`matches/${gameId}/homeScore`] = homeScore;
        if (awayScore >= 0 && match.awayScore !== awayScore) scoreUpdates[`matches/${gameId}/awayScore`] = awayScore;
      }
    }
  }
  console.log('Score updates found:', Object.keys(scoreUpdates).length);
  if (Object.keys(scoreUpdates).length > 0) await update(ref(db), scoreUpdates);
  console.log('Score updates:', JSON.stringify(scoreUpdates));

  // 4. Recalculate prediction points
  const updatedMatches = { ...matches };
  for (const [path, val] of Object.entries(scoreUpdates)) {
    const parts = path.split('/'); // matches/gameId/homeScore or awayScore
    const gameId = parts[1];
    const field = parts[2] as 'homeScore' | 'awayScore';
    updatedMatches[gameId] = { ...updatedMatches[gameId], [field]: val };
  }

  const usersSnapshot = await get(ref(db, 'users'));
  const users = usersSnapshot.val() as Record<string, unknown> | null;
  if (!users) return { scoresUpdated: Object.keys(scoreUpdates).length, pointsUpdated: 0, usersUpdated: 0 };

  const pointUpdates: Record<string, number> = {};
  for (const userId of Object.keys(users)) {
    const predsSnapshot = await get(ref(db, `predictions/${userId}`));
    const preds = predsSnapshot.val() as Record<string, Prediction> | null;
    if (!preds) continue;
    for (const [matchId, prediction] of Object.entries(preds)) {
      const match = updatedMatches[matchId];
      if (!match || match.homeScore < 0 || match.awayScore < 0) continue;
      const points = calculatePoints(match.homeScore, match.awayScore, prediction.homePrediction, prediction.awayPrediction);
      if (prediction.points !== points) pointUpdates[`predictions/${userId}/${matchId}/points`] = points;
    }
  }
  if (Object.keys(pointUpdates).length > 0) await update(ref(db), pointUpdates);

  // 5. Recalculate user total scores
  const userScores: Record<string, number> = {};
  for (const userId of Object.keys(users)) {
    const predsSnapshot = await get(ref(db, `predictions/${userId}`));
    const preds = predsSnapshot.val() as Record<string, Prediction> | null;
    if (!preds) { userScores[userId] = 0; continue; }
    let total = 0;
    for (const [matchId, pred] of Object.entries(preds)) {
      const updatedPoints = pointUpdates[`predictions/${userId}/${matchId}/points`];
      total += updatedPoints !== undefined ? updatedPoints : pred.points;
    }
    userScores[userId] = total;
  }

  const userScoreUpdates: Record<string, number> = {};
  for (const [userId, score] of Object.entries(userScores)) {
    userScoreUpdates[`users/${userId}/score`] = score;
  }
  if (Object.keys(userScoreUpdates).length > 0) await update(ref(db), userScoreUpdates);

  return {
    scoresUpdated: Object.keys(scoreUpdates).length,
    pointsUpdated: Object.keys(pointUpdates).length,
    usersUpdated: Object.keys(userScoreUpdates).length,
  };
};
