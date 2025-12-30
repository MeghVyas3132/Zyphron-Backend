import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight, Zap, Shield, Globe, Code2, Rocket, Database } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold">Zyphron</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition">
              Features
            </Link>
            <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition">
              Pricing
            </Link>
            <Link href="/docs" className="text-sm text-muted-foreground hover:text-foreground transition">
              Documentation
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/register">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm mb-6">
            <Rocket className="h-4 w-4" />
            <span>Now in Public Beta</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">
            Deploy <span className="text-gradient">Anything</span>,<br />
            <span className="text-gradient">Anywhere</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Next-generation universal deployment platform. Push your code, we handle the rest.
            Any language, any framework, instant deployments.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="gap-2">
                Start Deploying <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="outline">
                View Documentation
              </Button>
            </Link>
          </div>

          {/* Terminal Preview */}
          <div className="mt-16 terminal max-w-2xl mx-auto text-left">
            <div className="terminal-header">
              <div className="terminal-dot bg-red-500" />
              <div className="terminal-dot bg-yellow-500" />
              <div className="terminal-dot bg-green-500" />
              <span className="text-zinc-400 text-xs ml-2">Terminal</span>
            </div>
            <div className="terminal-content">
              <p><span className="text-green-400">$</span> git push origin main</p>
              <p className="text-zinc-400 mt-2">Pushing to origin...</p>
              <p className="text-zyphron-400 mt-2">✓ Zyphron detected push event</p>
              <p className="text-zyphron-400">✓ Building application...</p>
              <p className="text-zyphron-400">✓ Deploying to production...</p>
              <p className="text-green-400 mt-2">✓ Deployed to https://myapp.zyphron.dev</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto py-20 px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Everything You Need</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            From zero to production in minutes. No complex configurations required.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          <FeatureCard
            icon={<Code2 className="h-6 w-6" />}
            title="Universal Language Support"
            description="Node.js, Python, Go, Rust, Java, PHP, Ruby, and more. Auto-detection makes deployment effortless."
          />
          <FeatureCard
            icon={<Zap className="h-6 w-6" />}
            title="Instant Deployments"
            description="Push to deploy in seconds. Preview branches automatically get their own environments."
          />
          <FeatureCard
            icon={<Shield className="h-6 w-6" />}
            title="Built-in Security"
            description="Automatic SSL, DDoS protection, and encrypted environment variables out of the box."
          />
          <FeatureCard
            icon={<Database className="h-6 w-6" />}
            title="Managed Databases"
            description="PostgreSQL, MySQL, MongoDB, Redis. One-click provisioning with automatic backups."
          />
          <FeatureCard
            icon={<Globe className="h-6 w-6" />}
            title="Global Edge Network"
            description="Deploy to the edge for ultra-low latency. Your users get the fastest experience."
          />
          <FeatureCard
            icon={<Rocket className="h-6 w-6" />}
            title="Scale Automatically"
            description="From zero to millions. Horizontal scaling handles any traffic spike seamlessly."
          />
        </div>
      </section>

      {/* CTA Section */}
      <section className="container mx-auto py-20 px-4">
        <div className="max-w-4xl mx-auto text-center bg-gradient-to-r from-zyphron-900 to-zyphron-800 rounded-2xl p-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Deploy?
          </h2>
          <p className="text-zyphron-200 max-w-xl mx-auto mb-8">
            Join thousands of developers who ship faster with Zyphron.
            Start deploying in under 5 minutes.
          </p>
          <Link href="/register">
            <Button size="lg" variant="secondary" className="gap-2">
              Get Started for Free <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/50">
        <div className="container mx-auto py-12 px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                <Zap className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="font-bold">Zyphron</span>
            </div>
            <p className="text-sm text-muted-foreground">
              2025 Zyphron. Open source and self-hostable.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-6 rounded-xl border bg-card hover:shadow-lg transition-shadow">
      <div className="h-12 w-12 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-4">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}
