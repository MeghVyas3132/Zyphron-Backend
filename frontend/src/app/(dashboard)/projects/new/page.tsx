'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Github, GitBranch, Folder, Loader2, CheckCircle2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GitRepository {
  id: string;
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  private: boolean;
  updatedAt: string;
}

export default function NewProjectPage() {
  const router = useRouter();
  const [step, setStep] = useState<'select' | 'configure'>('select');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedRepo, setSelectedRepo] = useState<GitRepository | null>(null);
  const [search, setSearch] = useState('');
  const [projectConfig, setProjectConfig] = useState({
    name: '',
    slug: '',
    rootDirectory: './',
  });

  // Mock repositories for development
  const mockRepos: GitRepository[] = [
    {
      id: '1',
      name: 'my-portfolio',
      fullName: 'user/my-portfolio',
      url: 'https://github.com/user/my-portfolio',
      defaultBranch: 'main',
      private: false,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
    },
    {
      id: '2',
      name: 'api-server',
      fullName: 'user/api-server',
      url: 'https://github.com/user/api-server',
      defaultBranch: 'main',
      private: true,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
    },
    {
      id: '3',
      name: 'blog-cms',
      fullName: 'user/blog-cms',
      url: 'https://github.com/user/blog-cms',
      defaultBranch: 'develop',
      private: false,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 72).toISOString(),
    },
    {
      id: '4',
      name: 'mobile-app',
      fullName: 'user/mobile-app',
      url: 'https://github.com/user/mobile-app',
      defaultBranch: 'main',
      private: true,
      updatedAt: new Date(Date.now() - 1000 * 60 * 60 * 96).toISOString(),
    },
  ];

  const filteredRepos = mockRepos.filter(
    (repo) =>
      repo.name.toLowerCase().includes(search.toLowerCase()) ||
      repo.fullName.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectRepo = (repo: GitRepository) => {
    setSelectedRepo(repo);
    setProjectConfig({
      name: repo.name.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
      slug: repo.name.toLowerCase(),
      rootDirectory: './',
    });
    setStep('configure');
  };

  const handleCreate = async () => {
    if (!selectedRepo) return;

    setCreating(true);
    try {
      const token = localStorage.getItem('auth-token');
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: projectConfig.name,
          slug: projectConfig.slug,
          gitUrl: selectedRepo.url,
          defaultBranch: selectedRepo.defaultBranch,
          rootDirectory: projectConfig.rootDirectory,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        router.push(`/projects/${data.data.slug}`);
      } else {
        console.error('Failed to create project');
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setCreating(false);
    }
  };

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/projects">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Create New Project</h1>
          <p className="text-muted-foreground">
            Import and deploy a Git repository
          </p>
        </div>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-4 py-4">
        <div className={`flex items-center gap-2 ${step === 'select' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 'select' ? 'bg-primary text-primary-foreground' : 
            step === 'configure' ? 'bg-green-500 text-white' : 'bg-muted'
          }`}>
            {step === 'configure' ? <CheckCircle2 className="h-4 w-4" /> : '1'}
          </div>
          <span className="font-medium">Select Repository</span>
        </div>
        <div className="flex-1 h-px bg-border" />
        <div className={`flex items-center gap-2 ${step === 'configure' ? 'text-primary' : 'text-muted-foreground'}`}>
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
            step === 'configure' ? 'bg-primary text-primary-foreground' : 'bg-muted'
          }`}>
            2
          </div>
          <span className="font-medium">Configure Project</span>
        </div>
      </div>

      {step === 'select' && (
        <div className="space-y-4">
          {/* GitHub Connection */}
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Github className="h-6 w-6" />
                <div>
                  <h3 className="font-semibold">GitHub</h3>
                  <p className="text-sm text-muted-foreground">
                    Import a repository from your GitHub account
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm">
                Configure
              </Button>
            </div>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search repositories..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Repository List */}
          <div className="rounded-lg border divide-y">
            {filteredRepos.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                No repositories found
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <div
                  key={repo.id}
                  className="flex items-center justify-between p-4 hover:bg-muted/50 cursor-pointer"
                  onClick={() => handleSelectRepo(repo)}
                >
                  <div className="flex items-center gap-3">
                    <Github className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{repo.fullName}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <GitBranch className="h-3 w-3" />
                        <span>{repo.defaultBranch}</span>
                        {repo.private && (
                          <>
                            <span>·</span>
                            <span className="text-yellow-600">Private</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    Import
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Import URL */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="font-semibold mb-2">Import from URL</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Enter the URL of a public Git repository
            </p>
            <div className="flex gap-2">
              <Input placeholder="https://github.com/user/repo" className="flex-1" />
              <Button>Import</Button>
            </div>
          </div>
        </div>
      )}

      {step === 'configure' && selectedRepo && (
        <div className="space-y-6">
          {/* Selected Repository */}
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-3">
              <Github className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="font-medium">{selectedRepo.fullName}</p>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <GitBranch className="h-3 w-3" />
                  <span>{selectedRepo.defaultBranch}</span>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setStep('select')}>
                Change
              </Button>
            </div>
          </div>

          {/* Configuration Form */}
          <div className="rounded-lg border bg-card p-6 space-y-4">
            <h3 className="font-semibold">Project Settings</h3>
            
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={projectConfig.name}
                onChange={(e) => {
                  setProjectConfig({
                    ...projectConfig,
                    name: e.target.value,
                    slug: generateSlug(e.target.value),
                  });
                }}
                placeholder="My Awesome Project"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Project Slug</Label>
              <Input
                id="slug"
                value={projectConfig.slug}
                onChange={(e) =>
                  setProjectConfig({ ...projectConfig, slug: generateSlug(e.target.value) })
                }
                placeholder="my-awesome-project"
              />
              <p className="text-xs text-muted-foreground">
                Your project will be available at: {projectConfig.slug}.zyphron.app
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="root">Root Directory</Label>
              <div className="flex items-center gap-2">
                <Folder className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="root"
                  value={projectConfig.rootDirectory}
                  onChange={(e) =>
                    setProjectConfig({ ...projectConfig, rootDirectory: e.target.value })
                  }
                  placeholder="./"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                The directory where your project's source code is located
              </p>
            </div>
          </div>

          {/* Auto Detection Info */}
          <div className="rounded-lg border bg-blue-500/10 border-blue-500/20 p-4">
            <h4 className="font-medium text-blue-600 dark:text-blue-400 mb-1">
              Auto-Detection Enabled
            </h4>
            <p className="text-sm text-muted-foreground">
              Zyphron will automatically detect your project's framework, build commands,
              and output directory during the first deployment.
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-4">
            <Button variant="outline" onClick={() => setStep('select')}>
              Back
            </Button>
            <Button onClick={handleCreate} disabled={creating || !projectConfig.name}>
              {creating ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                'Create Project'
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
