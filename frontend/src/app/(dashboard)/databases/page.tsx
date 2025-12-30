'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Database, MoreHorizontal, ExternalLink, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatRelativeTime } from '@/lib/utils';

interface DatabaseInstance {
  id: string;
  name: string;
  slug: string;
  type: 'POSTGRESQL' | 'MYSQL' | 'MONGODB' | 'REDIS';
  version: string;
  status: 'CREATING' | 'RUNNING' | 'STOPPED' | 'FAILED';
  host: string;
  port: number;
  databaseName: string;
  createdAt: string;
  storage: {
    used: number;
    total: number;
  };
}

const dbTypeConfig = {
  POSTGRESQL: { icon: '🐘', color: 'text-blue-500', label: 'PostgreSQL' },
  MYSQL: { icon: '🐬', color: 'text-orange-500', label: 'MySQL' },
  MONGODB: { icon: '🍃', color: 'text-green-500', label: 'MongoDB' },
  REDIS: { icon: '⚡', color: 'text-red-500', label: 'Redis' },
};

const statusConfig = {
  CREATING: { icon: Loader2, color: 'text-blue-500', bg: 'bg-blue-500/10', animate: true },
  RUNNING: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-500/10' },
  STOPPED: { icon: Clock, color: 'text-yellow-500', bg: 'bg-yellow-500/10' },
  FAILED: { icon: Database, color: 'text-red-500', bg: 'bg-red-500/10' },
};

export default function DatabasesPage() {
  const [databases, setDatabases] = useState<DatabaseInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const fetchDatabases = async () => {
      try {
        const token = localStorage.getItem('auth-token');
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/databases`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          setDatabases(data.data || []);
        }
      } catch (error) {
        console.error('Failed to fetch databases:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDatabases();
  }, []);

  // Mock data for development
  const mockDatabases: DatabaseInstance[] = [
    {
      id: '1',
      name: 'Production DB',
      slug: 'production-db',
      type: 'POSTGRESQL',
      version: '15.2',
      status: 'RUNNING',
      host: 'db-prod.zyphron.app',
      port: 5432,
      databaseName: 'app_production',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
      storage: { used: 2.4, total: 10 },
    },
    {
      id: '2',
      name: 'Cache Server',
      slug: 'cache-server',
      type: 'REDIS',
      version: '7.0',
      status: 'RUNNING',
      host: 'redis-prod.zyphron.app',
      port: 6379,
      databaseName: '0',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14).toISOString(),
      storage: { used: 0.5, total: 1 },
    },
    {
      id: '3',
      name: 'Analytics DB',
      slug: 'analytics-db',
      type: 'MONGODB',
      version: '6.0',
      status: 'CREATING',
      host: 'mongo-analytics.zyphron.app',
      port: 27017,
      databaseName: 'analytics',
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      storage: { used: 0, total: 20 },
    },
  ];

  const displayDatabases = databases.length > 0 ? databases : mockDatabases;
  
  const filteredDatabases = displayDatabases.filter(
    (db) =>
      db.name.toLowerCase().includes(search.toLowerCase()) ||
      db.slug.toLowerCase().includes(search.toLowerCase())
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
          <h1 className="text-3xl font-bold">Databases</h1>
          <p className="text-muted-foreground mt-1">
            Provision and manage your databases
          </p>
        </div>
        <Link href="/databases/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Database
          </Button>
        </Link>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search databases..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Databases List */}
      {filteredDatabases.length === 0 ? (
        <div className="text-center py-12">
          <Database className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            {search ? 'No databases found matching your search' : 'No databases yet'}
          </p>
          {!search && (
            <Link href="/databases/new">
              <Button className="mt-4">Create Your First Database</Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredDatabases.map((db) => (
            <DatabaseCard key={db.id} database={db} />
          ))}
        </div>
      )}
    </div>
  );
}

function DatabaseCard({ database }: { database: DatabaseInstance }) {
  const typeConfig = dbTypeConfig[database.type];
  const statusCfg = statusConfig[database.status];
  const StatusIcon = statusCfg.icon;
  const storagePercent = (database.storage.used / database.storage.total) * 100;

  return (
    <div className="rounded-lg border bg-card p-6">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="text-3xl">{typeConfig.icon}</div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold">{database.name}</h3>
              <span className={`text-xs px-2 py-0.5 rounded ${statusCfg.bg} ${statusCfg.color} flex items-center gap-1`}>
                <StatusIcon className={`h-3 w-3 ${statusCfg.animate ? 'animate-spin' : ''}`} />
                {database.status}
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              {typeConfig.label} {database.version}
            </p>
          </div>
        </div>
        <Button variant="ghost" size="icon">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <div>
          <p className="text-sm text-muted-foreground">Host</p>
          <p className="font-mono text-sm truncate">{database.host}:{database.port}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Database</p>
          <p className="font-mono text-sm">{database.databaseName}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Created</p>
          <p className="text-sm">{formatRelativeTime(database.createdAt)}</p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Storage</span>
          <span className="font-medium">{database.storage.used} GB / {database.storage.total} GB</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${
              storagePercent > 80 ? 'bg-red-500' : storagePercent > 60 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${storagePercent}%` }}
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2">
        <Link href={`/databases/${database.slug}`}>
          <Button variant="outline" size="sm">
            Manage
          </Button>
        </Link>
        <Button variant="ghost" size="sm" className="gap-1">
          <ExternalLink className="h-3 w-3" />
          Connection String
        </Button>
      </div>
    </div>
  );
}
