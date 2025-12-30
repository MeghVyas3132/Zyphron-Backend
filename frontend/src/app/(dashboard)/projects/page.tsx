'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, MoreHorizontal, GitBranch, Globe, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRelativeTime } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  slug: string;
  framework: string;
  gitUrl: string;
  defaultBranch: string;
  productionUrl: string | null;
  lastDeployedAt: string | null;
  createdAt: string;
  _count?: {
    deployments: number;
  };
}

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

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const token = localStorage.getItem('auth-token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setProjects(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch projects:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProjects();
  }, []);

  // Mock data for development
  const mockProjects: Project[] = [
    {
      id: '1',
      name: 'My Portfolio',
      slug: 'my-portfolio',
      framework: 'nextjs',
      gitUrl: 'https://github.com/user/my-portfolio',
      defaultBranch: 'main',
      productionUrl: 'https://my-portfolio.zyphron.app',
      lastDeployedAt: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7).toISOString(),
      _count: { deployments: 45 },
    },
    {
      id: '2',
      name: 'API Server',
      slug: 'api-server',
      framework: 'express',
      gitUrl: 'https://github.com/user/api-server',
      defaultBranch: 'main',
      productionUrl: 'https://api-server.zyphron.app',
      lastDeployedAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
      _count: { deployments: 123 },
    },
    {
      id: '3',
      name: 'E-commerce App',
      slug: 'ecommerce-app',
      framework: 'react',
      gitUrl: 'https://github.com/user/ecommerce-app',
      defaultBranch: 'develop',
      productionUrl: null,
      lastDeployedAt: null,
      createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
      _count: { deployments: 0 },
    },
  ];

  const displayProjects = projects.length > 0 ? projects : mockProjects;
  
  const filteredProjects = displayProjects.filter(
    (project) =>
      project.name.toLowerCase().includes(search.toLowerCase()) ||
      project.slug.toLowerCase().includes(search.toLowerCase())
  );

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Projects</h1>
          <p className="text-muted-foreground mt-1">
            Manage and deploy your applications
          </p>
        </div>
        <Link href="/projects/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Projects Grid */}
      {filteredProjects.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            {search ? 'No projects found matching your search' : 'No projects yet'}
          </p>
          {!search && (
            <Link href="/projects/new">
              <Button className="mt-4">Create Your First Project</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: Project }) {
  const frameworkIcon = frameworkIcons[project.framework] || '📦';

  return (
    <Link href={`/projects/${project.slug}`}>
      <div className="rounded-lg border bg-card p-6 hover:border-primary transition-colors cursor-pointer group">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{frameworkIcon}</span>
            <div>
              <h3 className="font-semibold group-hover:text-primary transition-colors">
                {project.name}
              </h3>
              <p className="text-sm text-muted-foreground">{project.slug}</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <GitBranch className="h-4 w-4" />
            <span>{project.defaultBranch}</span>
          </div>

          {project.productionUrl && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Globe className="h-4 w-4" />
              <span className="truncate">{project.productionUrl.replace('https://', '')}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            <span>
              {project.lastDeployedAt
                ? `Deployed ${formatRelativeTime(project.lastDeployedAt)}`
                : 'No deployments yet'}
            </span>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {project._count?.deployments || 0} deployments
          </span>
          <span className="text-primary font-medium">View →</span>
        </div>
      </div>
    </Link>
  );
}
