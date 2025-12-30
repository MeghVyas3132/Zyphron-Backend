/**
 * Static site deployment utilities
 */

const fs = require('fs');
const path = require('path');
const { runCmd } = require('../../utils/command');
const { setupNginx } = require('./nginx');
const { findProjectRoot } = require('./detector');

/**
 * Find the static files directory for a project
 * @param {string} projectPath - Project path
 * @returns {string} - Path to static files
 */
function findStaticPath(projectPath) {
  const actualProjectPath = findProjectRoot(projectPath);

  const buildPath = path.join(actualProjectPath, 'build');
  const distPath = path.join(actualProjectPath, 'dist');
  const nextPath = path.join(actualProjectPath, '.next');
  const outPath = path.join(actualProjectPath, 'out');
  const publicPath = path.join(actualProjectPath, 'public');

  if (fs.existsSync(buildPath)) {
    console.log('Found build folder (React), using build/ directory');
    return buildPath;
  }

  if (fs.existsSync(distPath)) {
    console.log('Found dist folder (Vue/Angular/Svelte), using dist/ directory');
    return distPath;
  }

  if (fs.existsSync(outPath)) {
    console.log('Found out folder (Next.js export), using out/ directory');
    return outPath;
  }

  if (fs.existsSync(nextPath)) {
    console.log('Found .next folder (Next.js), using .next/ directory');
    return nextPath;
  }

  if (fs.existsSync(publicPath)) {
    console.log('Found public folder, using public/ directory');
    return publicPath;
  }

  console.log('No build/dist/out folder found, using project root');
  return actualProjectPath;
}

/**
 * Ensure index.html exists in static path
 * @param {string} staticPath - Path to static files
 */
function ensureIndexHtml(staticPath) {
  const files = fs.readdirSync(staticPath);

  if (!files.includes('index.html')) {
    const firstHtml = files.find(f => f.toLowerCase().endsWith('.html'));
    if (firstHtml) {
      fs.renameSync(
        path.join(staticPath, firstHtml),
        path.join(staticPath, 'index.html')
      );
      console.log(`Renamed ${firstHtml} to index.html`);
    }
  }
}

/**
 * Set proper permissions for static files
 * @param {string} staticPath - Path to static files
 */
async function setPermissions(staticPath) {
  try {
    await runCmd(`sudo chown -R ubuntu:www-data "${staticPath}" || true`);
    await runCmd(`sudo chmod -R 755 "${staticPath}" || true`);
    console.log('Permissions set successfully');
  } catch (e) {
    console.warn('Permission change warning:', e);
  }
}

/**
 * Deploy a static site
 * @param {string} projectName - Project name
 * @param {string} projectPath - Project path
 * @returns {Object} - Deployment result
 */
async function deployStaticSite(projectName, projectPath) {
  console.log(`Deploying static site: ${projectName}`);

  // Find static files
  const staticPath = findStaticPath(projectPath);

  // Ensure index.html exists
  ensureIndexHtml(staticPath);

  // Set permissions
  await setPermissions(staticPath);

  // Setup Nginx
  await setupNginx(projectName, 'static', { staticPath });

  return {
    type: 'static',
    staticPath,
    status: 'running',
  };
}

module.exports = {
  findStaticPath,
  ensureIndexHtml,
  setPermissions,
  deployStaticSite,
};
