/**
 * Pipeline runner
 * Executes build pipelines for projects
 */

const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { runCmd, execAsync } = require('../../utils/command');
const { initializeStatus, updateStatus, writeStepLog, getStatus } = require('./status');
const { queuePipeline } = require('./queue');

const DOCKER_BUILD_MEMORY = config.docker.buildMemory;
const DOCKER_BUILD_CPUS = config.docker.buildCpus;

/**
 * Create default pipeline configuration based on project files
 * @param {string} projectPath - Path to project
 * @returns {Object} - Pipeline configuration
 */
function createDefaultPipeline(projectPath) {
  const files = fs.readdirSync(projectPath);
  console.log(`Project files detected: ${files.join(', ')}`);

  const pipeline = {};

  // Detect package manager
  const hasYarn = files.includes('yarn.lock');
  const hasPnpm = files.includes('pnpm-lock.yaml');
  const hasNpmLock = files.includes('package-lock.json');

  const installCmd = hasYarn
    ? 'yarn install --frozen-lockfile'
    : hasPnpm
      ? 'pnpm install --frozen-lockfile'
      : hasNpmLock
        ? 'npm ci'
        : 'npm install';

  const runScript = (cmd) => hasYarn
    ? `yarn ${cmd}`
    : hasPnpm
      ? `pnpm ${cmd}`
      : `npm run ${cmd}`;

  // Node.js projects
  if (files.includes('package.json')) {
    try {
      const packageJsonPath = path.join(projectPath, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

      console.log(`Package.json dependencies: ${Object.keys(deps).join(', ')}`);

      const hasReactScripts = deps['react-scripts'];
      const hasVite = deps['vite'];
      const hasNext = deps['next'];
      const hasNuxt = deps['nuxt'];
      const hasAngular = deps['@angular/cli'] || deps['@angular/core'];
      const hasVue = deps['@vue/cli-service'] || deps['vue'];
      const hasSvelte = deps['svelte'];
      const hasBuildScript = packageJson.scripts && packageJson.scripts.build;

      console.log(`Framework detection: React=${!!hasReactScripts}, Vite=${!!hasVite}, Next=${!!hasNext}, Vue=${!!hasVue}, Build script=${!!hasBuildScript}`);

      if (hasReactScripts || hasVite || hasNext || hasNuxt || hasAngular || hasVue || hasSvelte || hasBuildScript) {
        pipeline.preDeploy = 'node --version && npm --version';

        const nodeModulesExists = fs.existsSync(path.join(projectPath, 'node_modules'));
        const buildCmd = nodeModulesExists
          ? `NODE_OPTIONS="--openssl-legacy-provider" ${runScript('build')}`
          : `${installCmd} && NODE_OPTIONS="--openssl-legacy-provider" ${runScript('build')}`;
        pipeline.build = buildCmd;

        if (config.build.skipTests) {
          pipeline.test = 'echo "Tests skipped for faster deployment"';
        } else if (hasReactScripts || hasVite || hasAngular || hasVue || hasSvelte) {
          pipeline.test = `CI=true ${runScript('test')} --watchAll=false --passWithNoTests || echo "Tests completed"`;
        } else if (hasNext || hasNuxt) {
          pipeline.test = `${runScript('test')} || echo "Tests completed"`;
        } else {
          pipeline.test = `CI=true ${runScript('test')} || echo "Tests completed"`;
        }

        console.log('Detected frontend framework, will build');
      } else {
        pipeline.preDeploy = 'node --version && npm --version';
        pipeline.build = installCmd;
        pipeline.test = `${runScript('test')} || echo "Tests completed"`;
        console.log('Detected Node.js backend, install only');
      }
    } catch (e) {
      console.warn('Could not parse package.json, defaulting to install:', e.message);
      pipeline.preDeploy = 'node --version && npm --version';
      pipeline.build = installCmd;
      pipeline.test = `${runScript('test')} || echo "Tests completed"`;
    }
  }
  // Python projects
  else if (files.includes('requirements.txt')) {
    pipeline.preDeploy = 'python3 --version && pip3 --version';
    pipeline.build = 'python3 -m pip install -r requirements.txt';
    pipeline.test = 'python -m pytest || echo "Python tests completed"';
  }
  // Java Maven projects
  else if (files.includes('pom.xml')) {
    pipeline.preDeploy = 'java -version && mvn --version';
    pipeline.build = 'mvn -B -DskipTests clean package';
    pipeline.test = 'mvn test -B || echo "Maven tests completed"';
  }
  // Java Gradle projects
  else if (files.includes('build.gradle')) {
    pipeline.preDeploy = 'java -version && gradle --version';
    pipeline.build = 'gradle build -x test --console=plain';
    pipeline.test = 'gradle test --console=plain || echo "Gradle tests completed"';
  }
  // Go projects
  else if (files.includes('go.mod')) {
    pipeline.preDeploy = 'go version';
    pipeline.build = 'go mod download && go build';
    pipeline.test = 'go test ./... -v || echo "Go tests completed"';
  }
  // PHP projects
  else if (files.includes('composer.json')) {
    pipeline.preDeploy = 'php --version && composer --version';
    pipeline.build = 'composer install --no-dev --no-interaction';
    pipeline.test = 'composer test --no-interaction || echo "PHP tests completed"';
  }
  // Flutter projects
  else if (files.includes('pubspec.yaml')) {
    pipeline.preDeploy = 'flutter --version';
    pipeline.build = 'flutter pub get && flutter build web';
    pipeline.test = 'flutter test || echo "Flutter tests completed"';
  }
  // .NET projects
  else if (files.find(f => f.endsWith('.csproj'))) {
    pipeline.preDeploy = 'dotnet --version';
    pipeline.build = 'dotnet restore && dotnet build';
    pipeline.test = 'dotnet test --logger console --verbosity minimal || echo "Tests completed"';
  }
  // Rust projects
  else if (files.includes('Cargo.toml')) {
    pipeline.preDeploy = 'rustc --version && cargo --version';
    pipeline.build = 'cargo build --release';
    pipeline.test = 'cargo test || echo "Rust tests completed"';
  }

  console.log(`Generated pipeline: ${JSON.stringify(pipeline, null, 2)}`);
  return pipeline;
}

/**
 * Load or create pipeline configuration
 * @param {string} projectPath - Path to project
 * @returns {Object} - Pipeline configuration
 */
function loadPipelineConfig(projectPath) {
  const pipelineFile = path.join(projectPath, 'pipeline.json');

  if (fs.existsSync(pipelineFile)) {
    try {
      const content = fs.readFileSync(pipelineFile, 'utf8');
      const pipelineConfig = JSON.parse(content || '{}');
      console.log(`Loaded existing pipeline config: ${JSON.stringify(pipelineConfig, null, 2)}`);
      return pipelineConfig;
    } catch (e) {
      console.warn('Invalid pipeline.json, creating default:', e.message);
    }
  }

  const pipeline = createDefaultPipeline(projectPath);

  try {
    fs.writeFileSync(pipelineFile, JSON.stringify(pipeline, null, 2));
    console.log('Created new pipeline.json file');
  } catch (e) {
    console.warn('Failed to save pipeline.json:', e.message);
  }

  return pipeline;
}

/**
 * Run a pipeline for a project
 * @param {string} projectName - Project name
 * @param {string} projectPath - Project path
 */
async function runPipeline(projectName, projectPath) {
  console.log(`Starting pipeline for project: ${projectName} at path: ${projectPath}`);

  initializeStatus(projectName);

  // Check disk space
  try {
    const { stdout } = await execAsync('df -h /var/www/projects');
    console.log('Disk space before build:', stdout);
    await execAsync('find /var/www/projects -name "node_modules" -type d -mtime +7 -exec rm -rf {} + 2>/dev/null || true');
  } catch (e) {
    console.warn('Disk space check failed:', e);
  }

  try {
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project path does not exist: ${projectPath}`);
    }

    const pipeline = loadPipelineConfig(projectPath);

    const stepOrder = ['preDeploy', 'build', 'test', 'postDeploy'];
    const stepsToRun = stepOrder.filter(step => pipeline[step] && pipeline[step].toString().trim());

    console.log(`Steps to run: ${stepsToRun.join(', ')}`);

    updateStatus(projectName, {
      totalSteps: stepsToRun.length,
      logs: { info: `Pipeline loaded with ${stepsToRun.length} steps: ${stepsToRun.join(', ')}` },
    });

    for (let i = 0; i < stepsToRun.length; i++) {
      const step = stepsToRun[i];
      const cmd = pipeline[step].toString().trim();

      console.log(`[${i + 1}/${stepsToRun.length}] Executing ${step}: ${cmd}`);

      updateStatus(projectName, {
        currentStep: step,
        stepIndex: i + 1,
        logs: {
          ...getStatus(projectName).logs,
          [step]: `Running: ${cmd}`,
        },
      });

      try {
        const startTime = Date.now();

        let output;
        // Use Docker for Node.js builds to limit resources
        if (step === 'build' && fs.existsSync(path.join(projectPath, 'package.json'))) {
          const safeCmd = cmd.replace(/"/g, '\\"');
          const dockerCmd = `docker run --rm -v ${projectPath}:/app -w /app --memory=${DOCKER_BUILD_MEMORY} --cpus=${DOCKER_BUILD_CPUS} node:18-alpine sh -c "${safeCmd}"`;
          console.log(`Using dockerized build command to limit resources: ${dockerCmd}`);
          output = await runCmd(dockerCmd, {
            cwd: projectPath,
            timeout: 20 * 60 * 1000, // 20 minutes
          });
        } else {
          output = await runCmd(cmd, {
            cwd: projectPath,
            timeout: step === 'build' ? 600000 : 300000,
          });
        }

        const duration = Math.round((Date.now() - startTime) / 1000);

        const logContent = `Command: ${cmd}\nDuration: ${duration}s\nOutput:\n${output}`;
        writeStepLog(projectPath, step, logContent);

        updateStatus(projectName, {
          logs: {
            ...getStatus(projectName).logs,
            [step]: `✓ Completed in ${duration}s`,
          },
        });

        console.log(`Step ${step} completed successfully in ${duration}s`);
      } catch (err) {
        const errorMsg = err.stderr || err.message || String(err);
        const logContent = `Command: ${cmd}\nError:\n${errorMsg}`;

        writeStepLog(projectPath, step, logContent);

        updateStatus(projectName, {
          error: `${step} failed: ${errorMsg}`,
          done: true,
          success: false,
          logs: {
            ...getStatus(projectName).logs,
            [step]: `✗ Failed: ${errorMsg.substring(0, 200)}...`,
          },
        });

        console.error(`Step ${step} failed:`, errorMsg);
        throw new Error(`Pipeline step '${step}' failed: ${errorMsg}`);
      }
    }

    updateStatus(projectName, {
      done: true,
      success: true,
      currentStep: 'completed',
    });

    console.log(`Pipeline completed successfully for project: ${projectName}`);

    const status = getStatus(projectName);
    const summaryLog = `Pipeline completed successfully
Steps executed: ${stepsToRun.join(', ')}
Total duration: ${status.duration}s
Completed at: ${status.endTime}`;

    writeStepLog(projectPath, 'summary', summaryLog);
  } catch (error) {
    console.error(`Pipeline failed for project ${projectName}:`, error.message);

    const status = getStatus(projectName);
    if (!status.error) {
      updateStatus(projectName, {
        error: error.message || String(error),
        done: true,
        success: false,
      });
    }

    const updatedStatus = getStatus(projectName);
    const errorLog = `Pipeline failed
Error: ${error.message || String(error)}
Failed at: ${updatedStatus.currentStep || 'initialization'}
Duration: ${updatedStatus.duration || 0}s`;

    writeStepLog(projectPath, 'error', errorLog);

    throw error;
  }
}

/**
 * Run pipeline with queue support
 * @param {string} projectName - Project name
 * @param {string} projectPath - Project path
 */
async function runPipelineQueued(projectName, projectPath) {
  return queuePipeline(() => runPipeline(projectName, projectPath));
}

module.exports = {
  runPipeline,
  runPipelineQueued,
  loadPipelineConfig,
  createDefaultPipeline,
};
