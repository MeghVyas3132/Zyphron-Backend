/**
 * Deployment service exports
 */

const { findProjectRoot, detectLanguage, detectProject, detectFullStackProject, languages } = require('./detector');
const { deployMicroservice, deployDatabaseService, cleanupContainer, getContainerStatus, getContainerLogs } = require('./docker');
const { generateStaticConfig, generateBackendConfig, generateFullStackConfig, writeNginxConfig, removeNginxConfig, reloadNginx, setupNginx } = require('./nginx');
const { findStaticPath, ensureIndexHtml, setPermissions, deployStaticSite } = require('./static');
const { deployFullStackApp } = require('./fullstack');

module.exports = {
  // Detection
  findProjectRoot,
  detectLanguage,
  detectProject,
  detectFullStackProject,
  languages,

  // Docker
  deployMicroservice,
  deployDatabaseService,
  cleanupContainer,
  getContainerStatus,
  getContainerLogs,

  // Nginx
  generateStaticConfig,
  generateBackendConfig,
  generateFullStackConfig,
  writeNginxConfig,
  removeNginxConfig,
  reloadNginx,
  setupNginx,

  // Static deployment
  findStaticPath,
  ensureIndexHtml,
  setPermissions,
  deployStaticSite,

  // Full-stack deployment
  deployFullStackApp,
};
