'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { 
  ArrowUpRight,
  GitBranch,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Activity,
  Server,
  Database,
  FolderKanban
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatRelativeTime } from '@/lib/utils';

interface DashboardStats {
  totalProjects: number;
  activeDeployments: number;
  totalDatabases: number;
  deploymentsToday: number;
  successRate: number;
}

interface RecentDeployment {
  id: string;
  projectName: string;
  projectSlug: string;
  status: 'PENDING' | 'BUILDING' | 'DEPLOYING' | 'READY' | 'FAILED' | 'CANCELLED';
  createdAt: string;
  branch: string;
  commitSha: string;
}

const statusConfig = {
  PENDING: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  BUILDING: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10', animate: true },
  DEPLOYING: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10', animate: true },
  READY: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
  FAILED: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10' },
  CANCELLED: { icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-500/10' },
};

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentDeployments, setRecentDeployments] = useState<RecentDeployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch dashboard data
    const fetchDashboard = async () => {
      try {
        const token = localStorage.getItem('auth-token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/dashboard/metrics`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          setStats(data.data.overview);
          setRecentDeployments(data.data.recentActivity || []);
        }
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  // Mock data for now
  const mockStats: DashboardStats = {
    totalProjects: 12,
    activeDeployments: 8,
    totalDatabases: 5,
    deploymentsToday: 23,
    successRate: 96.5,
  };

  const mockDeployments: RecentDeployment[] = [
    {
      id: '1',
      projectName: 'My Website',
      projectSlug: 'my-website',
      status: 'READY',
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      branch: 'main',
      commitSha: 'abc1234',
    },
    {
      id: '2',
      projectName: 'API Server',
      projectSlug: 'api-server',
      status: 'BUILDING',
      createdAt: new Date(Date.now() - 1000 * 60 * 2).toISOString(),
      branch: 'feature/auth',
      commitSha: 'def5678',
    },
    {
      id: '3',
      projectName: 'Mobile Backend',
      projectSlug: 'mobile-backend',
      status: 'FAILED',
      createdAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      branch: 'main',
      commitSha: 'ghi9012',
    },
  ];

  const displayStats = stats || mockStats;
  const displayDeployments = recentDeployments.length > 0 ? recentDeployments : mockDeployments;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here's an overview of your projects.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Projects"
          value={displayStats.totalProjects}
          icon={FolderKanban}
          href="/projects"
        />
        <StatCard
          title="Active Deployments"
          value={displayStats.activeDeployments}
          icon={Server}
          trend={{ value: 12, positive: true }}
        />
        <StatCard
          title="Databases"
          value={displayStats.totalDatabases}
          icon={Database}
          href="/databases"
        />
        <StatCard
          title="Success Rate"
          value={`${displayStats.successRate}%`}
          icon={Activity}
          trend={{ value: 2.5, positive: true }}
        />
      </div>

      {/* Recent Deployments */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Deployments</h2>
          <Link href="/projects">
            <Button variant="ghost" size="sm" className="gap-2">
              View All <ArrowUpRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="rounded-lg border bg-card">
          {displayDeployments.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-muted-foreground">No deployments yet</p>
              <Link href="/projects/new">
                <Button className="mt-4">Create Your First Project</Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {displayDeployments.map((deployment) => {
                const config = statusConfig[deployment.status];
                const StatusIcon = config.icon;

                return (
                  <Link
                    key={deployment.id}
                    href={`/projects/${deployment.projectSlug}/deployments/${deployment.id}`}
                    className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${config.bg}`}>
                        <StatusIcon
                          className={`h-4 w-4 ${config.color} ${
                            config.animate ? 'animate-spin' : ''
                          }`}
                        />
                      </div>
                      <div>
                        <p className="font-medium">{deployment.projectName}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <GitBranch className="h-3 w-3" />
                          <span>{deployment.branch}</span>
                          <span>·</span>
                          <span>{deployment.commitSha.slice(0, 7)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatRelativeTime(deployment.createdAt)}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link href="/projects/new">
            <div className="rounded-lg border bg-card p-6 hover:border-primary transition-colors cursor-pointer">
              <FolderKanban className="h-8 w-8 text-primary mb-4" />
              <h3 className="font-semibold">Create Project</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Deploy a new application from Git
              </p>
            </div>
          </Link>
          <Link href="/databases/new">
            <div className="rounded-lg border bg-card p-6 hover:border-primary transition-colors cursor-pointer">
              <Database className="h-8 w-8 text-primary mb-4" />
              <h3 className="font-semibold">Create Database</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Provision a managed database
              </p>
            </div>
          </Link>
          <Link href="/docs">
            <div className="rounded-lg border bg-card p-6 hover:border-primary transition-colors cursor-pointer">
              <Activity className="h-8 w-8 text-primary mb-4" />
              <h3 className="font-semibold">View Documentation</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Learn how to use Zyphron
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  href,
  trend,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  href?: string;
  trend?: { value: number; positive: boolean };
}) {
  const content = (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{title}</p>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <p className="text-3xl font-bold">{value}</p>
        {trend && (
          <span
            className={`text-sm ${
              trend.positive ? 'text-green-500' : 'text-red-500'
            }`}
          >
            {trend.positive ? '+' : '-'}{trend.value}%
          </span>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="hover:opacity-80 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
