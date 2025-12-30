/**
 * Nginx configuration utilities
 */

const fs = require('fs');
const { runCmd } = require('../../utils/command');
const config = require('../../config');

const NGINX_SITES_AVAILABLE = '/etc/nginx/sites-available';
const NGINX_SITES_ENABLED = '/etc/nginx/sites-enabled';

/**
 * Generate Nginx config for a static site
 * @param {string} projectName - Project name
 * @param {string} staticPath - Path to static files
 * @returns {string} - Nginx configuration
 */
function generateStaticConfig(projectName, staticPath) {
  const domain = `${projectName}.${config.domain.base}`;

  return `
server {
    listen 80;
    server_name ${domain};
    root ${staticPath};
    index index.html;

    # Handle React Router (SPA)
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
`;
}

/**
 * Generate Nginx config for a backend service
 * @param {string} projectName - Project name
 * @param {number} port - Backend port
 * @returns {string} - Nginx configuration
 */
function generateBackendConfig(projectName, port) {
  const domain = `${projectName}.${config.domain.base}`;

  return `
server {
    listen 80;
    server_name ${domain};

    location / {
        proxy_pass http://127.0.0.1:${port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
`;
}

/**
 * Generate Nginx config for a full-stack application
 * @param {string} projectName - Project name
 * @param {Object} deployedServices - Deployed services with ports
 * @returns {string} - Nginx configuration
 */
function generateFullStackConfig(projectName, deployedServices) {
  const domain = `${projectName}.${config.domain.base}`;

  let nginxConfig = `
server {
    listen 80;
    server_name ${domain};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
`;

  if (deployedServices.backend) {
    nginxConfig += `
    # Backend API routes
    location /api/ {
        proxy_pass http://127.0.0.1:${deployedServices.backend.port}/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
`;
  }

  if (deployedServices.frontend) {
    nginxConfig += `
    # Frontend application (SPA)
    location / {
        proxy_pass http://127.0.0.1:${deployedServices.frontend.port};
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        try_files $uri $uri/ @frontend;
    }

    location @frontend {
        proxy_pass http://127.0.0.1:${deployedServices.frontend.port};
    }
`;
  }

  nginxConfig += `
}
`;

  return nginxConfig;
}

/**
 * Write and enable Nginx configuration
 * @param {string} projectName - Project name
 * @param {string} configContent - Nginx configuration content
 */
async function writeNginxConfig(projectName, configContent) {
  const availablePath = `${NGINX_SITES_AVAILABLE}/${projectName}`;
  const enabledPath = `${NGINX_SITES_ENABLED}/${projectName}`;

  // Write config file
  fs.writeFileSync(availablePath, configContent);

  // Create symlink if not exists
  if (!fs.existsSync(enabledPath)) {
    fs.symlinkSync(availablePath, enabledPath);
  }
}

/**
 * Remove Nginx configuration
 * @param {string} projectName - Project name
 */
async function removeNginxConfig(projectName) {
  const availablePath = `${NGINX_SITES_AVAILABLE}/${projectName}`;
  const enabledPath = `${NGINX_SITES_ENABLED}/${projectName}`;

  try {
    if (fs.existsSync(enabledPath)) fs.unlinkSync(enabledPath);
    if (fs.existsSync(availablePath)) fs.unlinkSync(availablePath);
  } catch (e) {
    console.warn('Failed to remove nginx files:', e);
  }
}

/**
 * Test and reload Nginx
 */
async function reloadNginx() {
  try {
    await runCmd('sudo nginx -t && sudo systemctl reload nginx');
    console.log('Nginx reloaded successfully');
  } catch (e) {
    throw new Error(`Nginx reload failed: ${e.stderr || e.message}`);
  }
}

/**
 * Setup complete Nginx configuration
 * @param {string} projectName - Project name
 * @param {string} type - Configuration type ('static', 'backend', 'fullstack')
 * @param {Object} options - Additional options (staticPath, port, deployedServices)
 */
async function setupNginx(projectName, type, options = {}) {
  let configContent;

  switch (type) {
    case 'static':
      configContent = generateStaticConfig(projectName, options.staticPath);
      break;
    case 'backend':
      configContent = generateBackendConfig(projectName, options.port);
      break;
    case 'fullstack':
      configContent = generateFullStackConfig(projectName, options.deployedServices);
      break;
    default:
      throw new Error(`Unknown Nginx config type: ${type}`);
  }

  await writeNginxConfig(projectName, configContent);
  await reloadNginx();
}

module.exports = {
  generateStaticConfig,
  generateBackendConfig,
  generateFullStackConfig,
  writeNginxConfig,
  removeNginxConfig,
  reloadNginx,
  setupNginx,
};
