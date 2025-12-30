/**
 * Express application setup
 * Zyphron Deployment Platform
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const unzipper = require('unzipper');

const config = require('./config');
const { authenticateUser, upload, handleUploadError, supabase } = require('./middleware');
const { sanitizeProjectName, validateRepoUrl, allocatePort, releasePort, getPort } = require('./utils');
const { runCmd } = require('./utils/command');
const { runPipelineQueued, getPipelineStatus, cleanupOldStatuses } = require('./services/pipeline');
const { 
  findProjectRoot, 
  detectProject, 
  detectFullStackProject, 
  deployStaticSite,
  deployMicroservice,
  cleanupContainer,
  getContainerStatus,
  setupNginx,
  removeNginxConfig,
  reloadNginx,
} = require('./services/deployment');
const { detectDatabaseIntegration, setupDatabaseEnv } = require('./services/database');
const { storePendingDeployment, getPendingDeployment, removePendingDeployment } = require('./services/state');
const { deployFullStackApp } = require('./services/deployment/fullstack');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Ensure projects directory exists
const PROJECTS_DIR = config.paths.projectsDir;
if (!fs.existsSync(PROJECTS_DIR)) {
  fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

// Cleanup old pipeline statuses periodically
setInterval(() => {
  cleanupOldStatuses();
}, 60 * 60 * 1000); // Every hour

// ============================================
// Health Check
// ============================================

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ============================================
// Pipeline Routes
// ============================================

app.get('/pipeline/:name/status', authenticateUser, (req, res) => {
  try {
    const projectName = sanitizeProjectName(req.params.name);
    const status = getPipelineStatus(projectName);
    res.json(status);
  } catch (err) {
    console.error('Pipeline status error:', err);
    res.status(500).json({ error: 'Failed to get pipeline status' });
  }
});

// ============================================
// Deploy Route
// ============================================

app.post('/deploy', authenticateUser, upload.single('file'), handleUploadError, async (req, res) => {
  try {
    const projectName = sanitizeProjectName(req.body.name || `project-${Date.now()}`);
    const force = req.body.force === 'true' || req.body.force === true;
    const projectPath = path.join(PROJECTS_DIR, projectName);

    console.log(`Starting deployment for project: ${projectName}`);

    // Validate input
    if (!req.file && !req.body.repoUrl) {
      return res.status(400).json({ error: 'No file or repository URL provided' });
    }

    if (req.body.repoUrl && !validateRepoUrl(req.body.repoUrl)) {
      return res.status(400).json({
        error: 'Invalid repository URL. Only GitHub, GitLab, and Bitbucket URLs are allowed.',
      });
    }

    // Handle existing project
    if (fs.existsSync(projectPath) && !force) {
      return res.status(409).json({
        error: 'Project with this name already exists. Use a different name or set force=true to redeploy.',
      });
    }

    if (fs.existsSync(projectPath) && force) {
      console.log(`Cleaning up existing project: ${projectName}`);
      try { fs.rmSync(projectPath, { recursive: true, force: true }); } catch (e) { /* ignore */ }
      await removeNginxConfig(projectName);
      await cleanupContainer(`${projectName}-container`, `${projectName}-image`);
    }

    // Create project directory
    if (!fs.existsSync(projectPath)) {
      fs.mkdirSync(projectPath, { recursive: true });
    }

    // Clone repo or extract file
    if (req.body.repoUrl) {
      const repoUrl = req.body.repoUrl.trim();
      console.log(`Cloning repo: ${repoUrl}`);

      try {
        await runCmd(`git clone "${repoUrl}" "${projectPath}"`);
        await runCmd(`sudo chown -R ubuntu:ubuntu "${projectPath}"`);
        await runCmd(`sudo chmod -R 755 "${projectPath}"`);
      } catch (e) {
        console.error('Git clone failed:', e);
        return res.status(500).json({
          error: 'Failed to clone repository',
          details: e.stderr || e.message,
        });
      }
    } else if (req.file) {
      try {
        await fs.createReadStream(req.file.path)
          .pipe(unzipper.Extract({ path: projectPath }))
          .promise();
        fs.unlinkSync(req.file.path);
      } catch (e) {
        console.error('File extraction failed:', e);
        return res.status(500).json({
          error: 'Failed to extract uploaded file',
          details: e.message,
        });
      }
    }

    // Check for database integration
    const dbIntegrations = detectDatabaseIntegration(projectPath);
    if (dbIntegrations && !req.body.dbCredentials) {
      const deploymentId = storePendingDeployment({
        projectName,
        projectPath,
        force,
        type: 'database_config_needed',
      });

      return res.status(202).json({
        status: 'db_credentials_required',
        message: 'Database credentials required',
        projectName,
        dbIntegrations,
        deploymentId,
      });
    }

    // Run pipeline
    try {
      const actualProjectPath = findProjectRoot(projectPath);
      await runPipelineQueued(projectName, actualProjectPath);

      // Check for build folder
      const files = fs.readdirSync(actualProjectPath);
      const hasPackageJson = files.includes('package.json');
      const hasBuildFolder = fs.existsSync(path.join(actualProjectPath, 'build')) || 
                            fs.existsSync(path.join(actualProjectPath, 'dist'));

      if (hasPackageJson && !hasBuildFolder) {
        console.log('No build folder found, attempting manual build...');
        try {
          const packageJson = JSON.parse(fs.readFileSync(path.join(actualProjectPath, 'package.json'), 'utf8'));
          if (packageJson.scripts && packageJson.scripts.build) {
            console.log('Running manual build command...');
            await runCmd('NODE_OPTIONS="--openssl-legacy-provider" npm run build', { cwd: actualProjectPath });
            console.log('Manual build completed');
          }
        } catch (e) {
          console.log('Manual build failed:', e.message);
        }
      }
    } catch (pipelineErr) {
      console.error('Pipeline failed for', projectName, pipelineErr);

      const logsDir = path.join(projectPath, 'logs');
      if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

      try {
        fs.writeFileSync(
          path.join(logsDir, 'deploy.log'),
          (pipelineErr && (pipelineErr.stderr || pipelineErr.message)) || String(pipelineErr)
        );
      } catch (ee) {
        console.warn('Failed to write deploy log', ee);
      }

      return res.status(500).json({
        error: 'Pipeline failed',
        details: pipelineErr.message || String(pipelineErr),
      });
    }

    // Detect project type
    console.log(`\n=== Starting Project Structure Detection ===`);
    let detection = detectFullStackProject(projectPath);

    if (!detection) {
      detection = detectProject(projectPath);
      console.log(detection ? `✓ Detected single ${detection.type} project` : '✗ No specific project type detected');
    } else {
      console.log(`✓ Full-stack application detected!`);
    }

    // Deploy based on type
    if (detection && detection.isFullStack) {
      return await deployFullStackApp(projectName, projectPath, detection, req, res);
    }

    if (detection && detection.type === 'static-build') {
      const result = await deployStaticSite(projectName, projectPath);

      try {
        await supabase.from('projects').insert({
          user_id: req.user.id,
          name: projectName,
          repo_url: req.body.repoUrl || null,
          type: 'static',
          status: 'running',
          subdomain: `${projectName}.${config.domain.base}`,
          port: null,
        });
      } catch (dbError) {
        console.error('Failed to save project to database:', dbError);
      }

      return res.json({
        message: 'Static site deployment successful',
        url: `http://${projectName}.${config.domain.base}`,
        name: projectName,
        type: 'static',
      });
    }

    if (!detection) {
      // Try as static site
      const result = await deployStaticSite(projectName, projectPath);

      try {
        await supabase.from('projects').insert({
          user_id: req.user.id,
          name: projectName,
          repo_url: req.body.repoUrl || null,
          type: 'static',
          status: 'running',
          subdomain: `${projectName}.${config.domain.base}`,
          port: null,
        });
      } catch (dbError) {
        console.error('Failed to save project to database:', dbError);
      }

      return res.json({
        message: 'Static site deployment successful',
        url: `http://${projectName}.${config.domain.base}`,
        name: projectName,
        type: 'static',
      });
    }

    // Backend deployment
    const { dockerfile, internalPort } = detection;
    const hostPort = allocatePort(projectName);

    console.log(`Deploying backend project with Docker. Host port: ${hostPort}, Internal port: ${internalPort}`);

    const serviceConfig = {
      path: projectPath,
      detection: { dockerfile, internalPort, type: detection.type },
    };

    try {
      const result = await deployMicroservice(projectName, '', serviceConfig);
      await setupNginx(projectName, 'backend', { port: hostPort });

      try {
        await supabase.from('projects').insert({
          user_id: req.user.id,
          name: projectName,
          repo_url: req.body.repoUrl || null,
          type: detection.type || 'backend',
          status: 'running',
          subdomain: `${projectName}.${config.domain.base}`,
          port: hostPort,
        });
      } catch (dbError) {
        console.error('Failed to save project to database:', dbError);
      }

      return res.json({
        message: 'Backend deployment successful (Docker + Nginx)',
        url: `http://${projectName}.${config.domain.base}`,
        name: projectName,
        port: hostPort,
        type: detection.type,
        language: detection.language,
      });
    } catch (e) {
      console.error('Docker deployment failed:', e);
      releasePort(projectName);
      return res.status(500).json({
        error: 'Docker deployment failed',
        details: e.message,
      });
    }
  } catch (err) {
    console.error('Deploy error:', err);
    return res.status(500).json({
      error: 'Deployment failed',
      details: err.message || String(err),
    });
  }
});

// ============================================
// Projects Routes
// ============================================

app.get('/projects', authenticateUser, async (req, res) => {
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch projects' });
    }

    res.json({ projects });
  } catch (err) {
    console.error('List projects error:', err);
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

app.get('/status/:name', authenticateUser, async (req, res) => {
  try {
    const projectName = sanitizeProjectName(req.params.name);
    const projectPath = path.join(PROJECTS_DIR, projectName);

    if (!fs.existsSync(projectPath)) {
      return res.status(404).json({ name: projectName, status: 'not found' });
    }

    const containerName = `${projectName}-container`;
    const dockerfileExists = fs.existsSync(path.join(projectPath, 'Dockerfile'));
    const buildIndexExists = fs.existsSync(path.join(projectPath, 'build', 'index.html'));
    const distIndexExists = fs.existsSync(path.join(projectPath, 'dist', 'index.html'));
    const indexHtmlExists = buildIndexExists || distIndexExists || fs.existsSync(path.join(projectPath, 'index.html'));

    if (indexHtmlExists && !dockerfileExists) {
      return res.json({
        name: projectName,
        status: 'running (static)',
        url: `http://${projectName}.${config.domain.base}`,
        type: 'static',
        createdAt: fs.statSync(projectPath).birthtime.toISOString(),
      });
    }

    const status = await getContainerStatus(containerName);

    return res.json({
      name: projectName,
      status,
      url: `http://${projectName}.${config.domain.base}`,
      type: 'backend',
      createdAt: fs.statSync(projectPath).birthtime.toISOString(),
      port: getPort(projectName),
    });
  } catch (err) {
    console.error('Status check error:', err);
    res.status(500).json({ error: 'Failed to get project status' });
  }
});

app.delete('/delete/:name', authenticateUser, async (req, res) => {
  try {
    const projectName = sanitizeProjectName(req.params.name);
    const projectPath = path.join(PROJECTS_DIR, projectName);

    console.log(`Deleting project: ${projectName}`);

    // Cleanup Docker
    await cleanupContainer(`${projectName}-container`, `${projectName}-image`);

    // Remove project files
    if (fs.existsSync(projectPath)) {
      fs.rmSync(projectPath, { recursive: true, force: true });
    }

    // Remove Nginx config
    await removeNginxConfig(projectName);

    // Release port
    releasePort(projectName);

    // Reload Nginx
    try {
      await reloadNginx();
    } catch (e) {
      console.error('Nginx reload failed:', e);
      return res.status(500).json({
        error: 'Failed to reload Nginx after deletion',
        details: e.stderr || e.message,
      });
    }

    // Remove from database
    const { error: dbError } = await supabase
      .from('projects')
      .delete()
      .eq('user_id', req.user.id)
      .eq('name', projectName);

    if (dbError) {
      console.error('Database deletion error:', dbError);
    }

    return res.json({ message: `Project ${projectName} deleted and subdomain shut down.` });
  } catch (err) {
    console.error('Delete error:', err);
    return res.status(500).json({
      error: 'Failed to delete project',
      details: err.message || String(err),
    });
  }
});

// ============================================
// Database Configuration Route
// ============================================

app.post('/deploy/:deploymentId/configure-db', authenticateUser, async (req, res) => {
  const { deploymentId } = req.params;
  const { dbCredentials } = req.body;

  try {
    const deployment = getPendingDeployment(deploymentId);
    if (!deployment) {
      return res.status(404).json({ error: 'Deployment not found or expired' });
    }

    setupDatabaseEnv(deployment.projectPath, dbCredentials);
    removePendingDeployment(deploymentId);

    req.body.dbCredentials = dbCredentials;

    const detection = detectFullStackProject(deployment.projectPath);
    if (detection && detection.isFullStack) {
      return await deployFullStackApp(
        deployment.projectName,
        deployment.projectPath,
        detection,
        req,
        res
      );
    }

    // Continue with single-project deployment
    return res.json({ message: 'Database configured, deployment will continue' });
  } catch (error) {
    console.error('Database configuration failed:', error);
    return res.status(500).json({
      error: 'Failed to configure database credentials',
      details: error.message,
    });
  }
});

// ============================================
// Auth Routes
// ============================================

app.post('/auth/signup', async (req, res) => {
  try {
    const { email, password, fullName } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName || email.split('@')[0] },
      },
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    res.json({
      message: 'User created successfully',
      user: { id: data.user.id, email: data.user.email },
      session: data.session,
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    res.json({
      message: 'Login successful',
      user: { id: data.user.id, email: data.user.email },
      session: data.session,
      access_token: data.session.access_token,
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/auth/logout', authenticateUser, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader.split(' ')[1];

    await supabase.auth.signOut(token);

    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.get('/auth/me', authenticateUser, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', req.user.id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: data });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// ============================================
// Error Handler
// ============================================

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

module.exports = app;
