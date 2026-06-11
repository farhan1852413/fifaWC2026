import { AppLayout, Card } from '../components';
import { worldcupLogo, createdByPic } from '../assets';

export const About = () => {
  return (
    <AppLayout>
      <div className="md:min-h-screen flex items-center justify-center px-4 py-8">
        <div className="max-w-2xl w-full">
          <Card className="p-6">

            {/* Project Header */}
            <div className="mb-6 text-center">
              <div className="flex flex-row items-center justify-center gap-4 mb-6 mt-4">
                <img src={worldcupLogo} alt="World Cup 2026" className="h-16" />
                <h2 className="md:text-2xl text-lg font-semibold text-white">
                  FIFA WORLD CUP 2026 POOL
                </h2>
              </div>

              <p className="text-white/80">
                A fun prediction game for FIFA World Cup 2026. Make your
                score predictions, compete with friends, and climb the leaderboard.
              </p>
            </div>

            <hr className="border-white/10 mb-6" />

            {/* Creator */}
            <div className="mb-6 flex items-center gap-4">
              <img
                src={createdByPic}
                alt="Creator"
                className="w-12 h-12 rounded-full object-cover border border-white/20"
              />
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Made by Farru
                </h2>
                <p className="text-white/60 text-sm">
                  Engineering student @ BMSCE
                </p>
              </div>
            </div>

            <hr className="border-white/10 mb-6" />

            {/* NEW SECTION (replacing contribute) */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white mb-3">
                ⚽ Why this project exists
              </h2>

              <p className="text-white/80 mb-3">
                This platform was built to make World Cup predictions more
                exciting, social, and competitive.
              </p>

              <p className="text-white/80 mb-3">
                Instead of just watching matches, you can:
              </p>

              <ul className="text-white/70 list-disc ml-5 space-y-1">
                <li>Predict match outcomes with friends</li>
                <li>Create private leagues for your circle</li>
                <li>Track leaderboard in real time</li>
                <li>Compete for bragging rights during the World Cup</li>
              </ul>
            </div>

            <hr className="border-white/10 mb-6" />

            {/* Footer */}
            <p className="text-white/50 text-sm text-center">
              Made with ❤️ for BMSCE bois
            </p>

          </Card>
        </div>
      </div>
    </AppLayout>
  );
};