/**
 * Project and language detection utilities
 */

const fs = require('fs');
const path = require('path');
const languages = require('../../config/languages.json');

/**
 * Find the project root by looking for package.json
 * @param {string} projectPath - Starting path
 * @param {number} maxDepth - Maximum depth to search
 * @returns {string} - Path to project root
 */
function findProjectRoot(projectPath, maxDepth = 3) {
  console.log(`Searching for project root in: ${projectPath}`);

  // Check if package.json exists at root
  if (fs.existsSync(path.join(projectPath, 'package.json'))) {
    console.log('Found package.json at root level');
    return projectPath;
  }

  function scanDirectory(currentPath, depth) {
    if (depth > maxDepth) return null;

    try {
      const items = fs.readdirSync(currentPath);
      const directories = items.filter(item => {
        try {
          const itemPath = path.join(currentPath, item);
          return fs.statSync(itemPath).isDirectory() &&
                 !item.startsWith('.') &&
                 item !== 'node_modules' &&
                 item !== 'logs';
        } catch (e) {
          return false;
        }
      });

      // First, check all directories at current level
      for (const dir of directories) {
        const subPath = path.join(currentPath, dir);
        if (fs.existsSync(path.join(subPath, 'package.json'))) {
          console.log(`Found package.json in: ${dir} at depth ${depth}`);
          return subPath;
        }
      }

      // Then recurse into subdirectories
      for (const dir of directories) {
        const subPath = path.join(currentPath, dir);
        const deeperResult = scanDirectory(subPath, depth + 1);
        if (deeperResult) return deeperResult;
      }
    } catch (e) {
      console.error(`Error scanning directory at depth ${depth}:`, e);
    }

    return null;
  }

  const result = scanDirectory(projectPath, 1);
  console.log(`Final project root: ${result || projectPath}`);
  return result || projectPath;
}

/**
 * Detect the programming language/framework of a project
 * @param {string} projectPath - Path to project
 * @returns {string|null} - Detected language key or null
 */
function detectLanguage(projectPath) {
  console.log(`Detecting language for project at: ${projectPath}`);
  const actualProjectPath = findProjectRoot(projectPath);

  try {
    const files = fs.readdirSync(actualProjectPath);
    console.log(`Files found: ${files.join(', ')}`);

    const matchesPattern = (filename, pattern) => {
      if (!pattern.includes('*')) return filename === pattern;
      const escaped = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*');
      const regex = new RegExp(`^${escaped}$`, 'i');
      return regex.test(filename);
    };

    const directories = files.filter(f => {
      try {
        return fs.statSync(path.join(actualProjectPath, f)).isDirectory();
      } catch (e) {
        return false;
      }
    });

    // Check package.json for framework detection
    if (files.includes('package.json')) {
      try {
        const packageJsonContent = fs.readFileSync(path.join(actualProjectPath, 'package.json'), 'utf8');
        const packageJson = JSON.parse(packageJsonContent);
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        console.log(`Dependencies found: ${Object.keys(dependencies).join(', ')}`);

        // React (Create React App)
        if (dependencies['react'] && dependencies['react-scripts']) {
          console.log('Detected: React (Create React App)');
          return 'react';
        }

        // Next.js
        if (dependencies['next']) {
          console.log('Detected: Next.js');
          return 'next';
        }

        // Vue.js
        if (dependencies['vue'] || dependencies['@vue/cli-service']) {
          console.log('Detected: Vue.js');
          return 'vue';
        }

        // Angular
        if (dependencies['@angular/core']) {
          console.log('Detected: Angular');
          return 'angular';
        }

        // Svelte
        if (dependencies['svelte']) {
          console.log('Detected: Svelte');
          return 'svelte';
        }

        // Nuxt
        if (dependencies['nuxt']) {
          console.log('Detected: Nuxt');
          return 'nuxt';
        }

        // Gatsby
        if (dependencies['gatsby']) {
          console.log('Detected: Gatsby');
          return 'gatsby';
        }

        // Vite project (generic)
        if (dependencies['vite']) {
          console.log('Detected: Vite project');
          return 'react';
        }

        // Express
        if (dependencies['express']) {
          console.log('Detected: Express');
          return 'express';
        }

        // Generic frontend with build script
        if (packageJson.scripts && packageJson.scripts.build &&
           (directories.includes('src') || directories.includes('public'))) {
          console.log('Detected: Generic frontend project with build script');
          return 'react';
        }

        // Node.js backend
        if (packageJson.scripts && (packageJson.scripts.start || packageJson.main)) {
          console.log('Detected: Node.js backend');
          return 'node';
        }

        console.log('Detected: Generic Node.js project');
        return 'node';
      } catch (e) {
        console.warn('Failed to parse package.json:', e.message);
      }
    }

    // Check for other language patterns
    for (const lang in languages) {
      const langConfig = languages[lang];

      if (lang === 'react' && langConfig.detect.length > 1) {
        const allMatch = langConfig.detect.every(pattern =>
          files.some(f => matchesPattern(f, pattern))
        );
        if (allMatch) {
          console.log(`Detected: ${lang} (all files present)`);
          return lang;
        }
      } else {
        const anyMatch = langConfig.detect.some(pattern =>
          files.some(f => matchesPattern(f, pattern))
        );
        if (anyMatch) {
          console.log(`Detected: ${lang}`);
          return lang;
        }
      }
    }

    console.log('No language detected');
    return null;
  } catch (error) {
    console.error('Error in detectLanguage:', error);
    return null;
  }
}

/**
 * Detect project type and configuration
 * @param {string} projectPath - Path to project
 * @returns {Object|null} - Project detection result
 */
function detectProject(projectPath) {
  console.log(`Detecting project type for: ${projectPath}`);

  try {
    const lang = detectLanguage(projectPath);
    if (!lang) {
      console.log('No language detected, returning null');
      return null;
    }

    const langConfig = languages[lang];
    if (!langConfig) {
      console.error(`Language config not found for: ${lang}`);
      return null;
    }

    console.log(`Project detected as: ${langConfig.type} (${lang})`);

    return {
      type: langConfig.type,
      dockerfile: langConfig.dockerfile,
      internalPort: langConfig.internalPort || 80,
      language: lang,
    };
  } catch (error) {
    console.error('Error in detectProject:', error);
    return null;
  }
}

/**
 * Detect full-stack project structure
 * @param {string} projectPath - Path to project
 * @returns {Object|null} - Full-stack detection result
 */
function detectFullStackProject(projectPath) {
  console.log('\n=== Full-Stack Detection Process ===');

  const files = fs.readdirSync(projectPath);
  const directories = files.filter(f => {
    try {
      return fs.statSync(path.join(projectPath, f)).isDirectory();
    } catch (e) {
      return false;
    }
  });

  console.log('📁 Analyzing project structure...');
  console.log(`├── Root directory: ${projectPath}`);
  console.log(`└── Found directories: ${directories.join(', ')}`);

  const services = [];
  const serviceConfig = {};

  console.log('\n📦 Checking project components...');

  const hasFrontend = directories.includes('frontend') || directories.includes('client');
  const hasBackend = directories.includes('backend') || directories.includes('server') || directories.includes('api');
  const hasDatabase = directories.includes('database') || directories.includes('db');
  const hasCompose = files.includes('docker-compose.yml') || files.includes('compose.yml');

  console.log(`├── Frontend (client): ${hasFrontend ? '✓ Found' : '✗ Not found'}`);
  console.log(`├── Backend (server): ${hasBackend ? '✓ Found' : '✗ Not found'}`);
  console.log(`├── Database: ${hasDatabase ? '✓ Found' : '✗ Not found'}`);
  console.log(`└── Docker Compose: ${hasCompose ? '✓ Found' : '✗ Not found'}`);

  if (!hasFrontend && !hasBackend) {
    console.log('\n❌ Not a full-stack project: Missing both frontend and backend');
    return null;
  }

  if (hasFrontend) {
    console.log('\n🎨 Configuring Frontend Service...');
    const frontendDir = directories.find(d => ['frontend', 'client'].includes(d));
    const frontendPath = path.join(projectPath, frontendDir);
    console.log(`├── Directory: ${frontendDir}`);
    console.log(`├── Path: ${frontendPath}`);

    const frontendDetection = detectProject(frontendPath);
    if (frontendDetection) {
      console.log(`├── Type: ${frontendDetection.type}`);
      console.log(`└── Framework: ${frontendDetection.language || 'standard'}`);
    }

    services.push('frontend');
    serviceConfig.frontend = {
      path: frontendPath,
      detection: frontendDetection || { type: 'static-build', dockerfile: languages.react.dockerfile, internalPort: 80 },
      subdirectory: frontendDir,
    };
  }

  if (hasBackend) {
    console.log('\n⚙️ Configuring Backend Service...');
    const backendDir = directories.find(d => ['backend', 'server', 'api'].includes(d));
    const backendPath = path.join(projectPath, backendDir);
    console.log(`├── Directory: ${backendDir}`);
    console.log(`├── Path: ${backendPath}`);

    const backendDetection = detectProject(backendPath);
    if (backendDetection) {
      console.log(`├── Type: ${backendDetection.type}`);
      console.log(`└── Framework: ${backendDetection.language || 'standard'}`);
    }

    services.push('backend');
    serviceConfig.backend = {
      path: backendPath,
      detection: backendDetection || { type: 'backend', dockerfile: languages.node.dockerfile, internalPort: 3000 },
      subdirectory: backendDir,
    };
  }

  if (hasDatabase || hasCompose) {
    console.log('\n🗄️ Configuring Database Service...');
    services.push('database');
    serviceConfig.database = {
      path: hasDatabase ? path.join(projectPath, 'database') : projectPath,
      detection: { type: 'database', internalPort: 5432 },
      subdirectory: 'database',
    };
  }

  return {
    type: 'fullstack',
    services,
    serviceConfig,
    isFullStack: true,
  };
}

module.exports = {
  findProjectRoot,
  detectLanguage,
  detectProject,
  detectFullStackProject,
  languages,
};
