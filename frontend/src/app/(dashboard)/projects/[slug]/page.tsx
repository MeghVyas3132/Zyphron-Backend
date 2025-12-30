'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Settings, 
  GitBranch, 
  Globe, 
  Clock,
  ExternalLink,
  RefreshCw,
  Trash2,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
  Terminal
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  slug: string;
  framework: string;
  gitUrl: string;
  defaultBranch: string;
  productionUrl: string | null;
  rootDirectory: string;
  buildCommand: string | null;
  outputDirectory: string | null;
  installCommand: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Deployment {
  id: string;
  status: 'PENDING' | 'BUILDING' | 'DEPLOYING' | 'READY' | 'FAILED' | 'CANCELLED';
  branch: string;
  commitSha: string;
  commitMessage: string;
  createdAt: string;
  completedAt: string | null;
  url: string | null;
  logs: string | null;
}

const statusConfig = {
  PENDING: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'Pending' },
  BUILDING: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Building', animate: true },
  DEPLOYING: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Deploying', animate: true },
  READY: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10', label: 'Ready' },
  FAILED: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Failed' },
  CANCELLED: { icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-500/10', label: 'Cancelled' },
};

const frameworkIcons: Record<string, string> = {
  nextjs: '▲',
  react: '⚛️',
  vue: '💚',
  nuxt: '💚',
  svelte: '🔥',
  angular: '🔺',
  express: '⚡',
  fastify: '⚡',
  nestjs: '🐱',
  static: '📄',
  docker: '🐳',
};

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  
  const [project, setProject] = useState<Project | null>(null);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [activeTab, setActiveTab] = useState<'deployments' | 'settings' | 'logs'>('deployments');

  useEffect(() => {
    const fetchProject = async () => {
      try {
        const token = localStorage.getItem('auth-token');
        const [projectRes, deploymentsRes] = await Promise.all([
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${slug}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${slug}/deployments`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (projectRes.ok) {
          const projectData = await projectRes.json();
          setProject(projectData.data);
        }
        if (deploymentsRes.ok) {
          const deploymentsData = await deploymentsRes.json();
          setDeployments(deploymentsData.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch project:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProject();
  }, [slug]);

  // Mock data for development
  const mockProject: Project = {
    id: '1',
    name: 'My Portfolio',
    slug: 'my-portfolio',
    framework: 'nextjs',
    gitUrl: 'https://github.com/user/my-portfolio',
    defaultBranch: 'main',
    productionUrl: 'https://my-portfolio.zyphron.app',
    rootDirectory: './',
    buildCommand: 'npm run build',
    outputDirectory: '.next',
    installCommand: 'npm install',
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  };

  const mockDeployments: Deployment[] = [
    {
      id: '1',
      status: 'READY',
      branch: 'main',
      commitSha: 'abc1234def5678',
      commitMessage: 'feat: add contact form',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      completedAt: new Date(Date.now() - 1000 * 60 * 28).toISOString(),
      url: 'https://my-portfolio.zyphron.app',
      logs: null,
    },
    {
      id: '2',
      status: 'READY',
      branch: 'main',
      commitSha: 'xyz9876abc5432',
      commitMessage: 'fix: mobile responsive issues',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 2 + 90000).toISOString(),
      url: 'https://deployment-2.my-portfolio.zyphron.app',
      logs: null,
    },
    {
      id: '3',
      status: 'FAILED',
      branch: 'feature/blog',
      commitSha: 'qwe4567rty8901',
      commitMessage: 'feat: add blog section (WIP)',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      completedAt: new Date(Date.now() - 1000 * 60 * 60 * 5 + 45000).toISOString(),
      url: null,
      logs: 'Build failed: Module not found: react-markdown',
    },
  ];

  const displayProject = project || mockProject;
  const displayDeployments = deployments.length > 0 ? deployments : mockDeployments;
  const frameworkIcon = frameworkIcons[displayProject.framework] || '📦';

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const token = localStorage.getItem('auth-token');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects/${slug}/deployments`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ branch: displayProject.defaultBranch }),
        }
      );

      if (response.ok) {
        // Refresh deployments list
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to deploy:', error);
    } finally {
      setDeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex items-center gap-3 flex-1">
          <span className="text-3xl">{frameworkIcon}</span>
          <div>
            <h1 className="text-2xl font-bold">{displayProject.name}</h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <GitBranch className="h-4 w-4" />
                <span>{displayProject.defaultBranch}</span>
              </div>
              {displayProject.productionUrl && (
                <a
                  href={displayProject.productionUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-primary"
                >
                  <Globe className="h-4 w-4" />
                  <span>{displayProject.productionUrl.replace('https://', '')}</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
          <Button onClick={handleDeploy} disabled={deploying}>
            {deploying ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Deploying...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Deploy
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex gap-4">
          <button
            onClick={() => setActiveTab('deployments')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'deployments'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Deployments
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'logs'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Logs
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 border-b-2 transition-colors ${
              activeTab === 'settings'
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            Settings
          </button>
        </div>
      </div>

      {/* Deployments Tab */}
      {activeTab === 'deployments' && (
        <div className="space-y-4">
          {displayDeployments.length === 0 ? (
            <div className="rounded-lg border bg-card p-8 text-center">
              <p className="text-muted-foreground mb-4">No deployments yet</p>
              <Button onClick={handleDeploy}>Deploy Now</Button>
            </div>
          ) : (
            <div className="rounded-lg border divide-y">
              {displayDeployments.map((deployment) => {
                const config = statusConfig[deployment.status];
                const StatusIcon = config.icon;

                return (
                  <div key={deployment.id} className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${config.bg}`}>
                          <StatusIcon
                            className={`h-4 w-4 ${config.color} ${
                              config.animate ? 'animate-spin' : ''
                            }`}
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{deployment.commitMessage}</p>
                            <span className={`text-xs px-2 py-0.5 rounded ${config.bg} ${config.color}`}>
                              {config.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <GitBranch className="h-3 w-3" />
                            <span>{deployment.branch}</span>
                            <span>·</span>
                            <span>{deployment.commitSha.slice(0, 7)}</span>
                            <span>·</span>
                            <Clock className="h-3 w-3" />
                            <span>{formatRelativeTime(deployment.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {deployment.url && (
                          <a
                            href={deployment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Button variant="outline" size="sm">
                              <ExternalLink className="h-4 w-4 mr-1" />
                              Visit
                            </Button>
                          </a>
                        )}
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    {deployment.logs && deployment.status === 'FAILED' && (
                      <div className="mt-3 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                        <div className="flex items-center gap-2 text-red-500 text-sm font-medium mb-1">
                          <Terminal className="h-4 w-4" />
                          Build Error
                        </div>
                        <p className="text-sm text-muted-foreground font-mono">{deployment.logs}</p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="space-y-6">
          {/* Build Settings */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold">Build Settings</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-sm text-muted-foreground">Framework</p>
                <p className="font-medium capitalize">{displayProject.framework || 'Auto-detected'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Root Directory</p>
                <p className="font-medium">{displayProject.rootDirectory}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Build Command</p>
                <p className="font-medium font-mono text-sm">{displayProject.buildCommand || 'Auto-detected'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Output Directory</p>
                <p className="font-medium font-mono text-sm">{displayProject.outputDirectory || 'Auto-detected'}</p>
              </div>
            </div>
          </div>

          {/* Git Settings */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold">Git Repository</h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm text-muted-foreground">Repository</p>
                <a
                  href={displayProject.gitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:text-primary flex items-center gap-1"
                >
                  {displayProject.gitUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Production Branch</p>
                <p className="font-medium">{displayProject.defaultBranch}</p>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-6 space-y-4">
            <h3 className="font-semibold text-red-500">Danger Zone</h3>
            <p className="text-sm text-muted-foreground">
              Once you delete a project, there is no going back. This action cannot be undone.
            </p>
            <Button variant="destructive" className="gap-2">
              <Trash2 className="h-4 w-4" />
              Delete Project
            </Button>
          </div>
        </div>
      )}

      {/* Logs Tab */}
      {activeTab === 'logs' && (
        <div className="rounded-lg border bg-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Live Logs</h3>
            <Button variant="outline" size="sm">
              <Activity className="h-4 w-4 mr-2" />
              Live
            </Button>
          </div>
          <div className="bg-black rounded-lg p-4 font-mono text-sm text-green-400 h-96 overflow-auto">
            <p>[2024-01-15 10:32:01] Cloning repository...</p>
            <p>[2024-01-15 10:32:03] Installing dependencies...</p>
            <p>[2024-01-15 10:32:15] Running build command...</p>
            <p>[2024-01-15 10:32:45] Build completed successfully</p>
            <p>[2024-01-15 10:32:46] Uploading artifacts...</p>
            <p>[2024-01-15 10:32:50] Deploying to edge network...</p>
            <p>[2024-01-15 10:32:55] ✓ Deployment ready</p>
            <p className="text-muted-foreground mt-4">No new logs...</p>
          </div>
        </div>
      )}
    </div>
  );
}
