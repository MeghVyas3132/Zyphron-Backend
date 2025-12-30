import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to your Zyphron account',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-zyphron-900 via-zyphron-800 to-zyphron-950 p-12 flex-col justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/10 flex items-center justify-center">
              <svg
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 10V3L4 14h7v7l9-11h-7z"
                />
              </svg>
            </div>
            <span className="text-2xl font-bold text-white">Zyphron</span>
          </div>
        </div>

        <div className="space-y-6">
          <blockquote className="text-xl text-white/90 font-medium leading-relaxed">
            "Zyphron transformed how we deploy. What used to take hours now takes seconds.
            The auto-detection and instant previews are game-changers."
          </blockquote>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-full bg-white/10" />
            <div>
              <p className="text-white font-medium">Alex Chen</p>
              <p className="text-white/60 text-sm">CTO at TechStartup</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-8 text-white/60 text-sm">
          <span>100k+ Deployments</span>
          <span>5k+ Projects</span>
          <span>99.99% Uptime</span>
        </div>
      </div>

      {/* Right side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  );
}
