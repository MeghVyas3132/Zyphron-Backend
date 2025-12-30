/**
 * Command execution utilities
 * Provides promisified exec with proper error handling
 */

const { exec } = require('child_process');
const util = require('util');

const execAsync = util.promisify(exec);

/**
 * Execute a shell command with options
 * @param {string} cmd - Command to execute
 * @param {Object} opts - Options (cwd, timeout, maxBuffer)
 * @returns {Promise<string>} - Command output
 */
async function runCmd(cmd, opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const timeout = opts.timeout || 300000; // 5 minutes default
  const maxBuffer = opts.maxBuffer || 1024 * 1024 * 20; // 20MB

  console.log(`Executing command: ${cmd} in ${cwd}`);

  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd,
      maxBuffer,
      timeout,
    });

    const combined = (stdout || '') + (stderr ? '\n' + stderr : '');
    console.log(`Command output: ${combined.substring(0, 500)}${combined.length > 500 ? '...' : ''}`);
    return combined;
  } catch (e) {
    const stderr = (e.stderr && e.stderr.toString && e.stderr.toString()) || e.message || String(e);
    console.error(`Command failed: ${cmd}`);
    console.error(`Error: ${stderr}`);

    const error = new Error(stderr);
    error.stderr = stderr;
    error.code = e.code;
    error.killed = e.killed;
    error.signal = e.signal;
    throw error;
  }
}

/**
 * Execute command with callback (legacy support)
 * @param {string} cmd - Command to execute
 * @param {Object} options - Options
 * @returns {Promise<string>} - Command output
 */
function runCmdCallback(cmd, options = {}) {
  return new Promise((resolve, reject) => {
    console.log(`Executing command: ${cmd}`);
    exec(cmd, options, (err, stdout, stderr) => {
      if (err) {
        console.error(`Command failed: ${cmd}`);
        console.error(`Error: ${stderr?.toString() || err.message}`);
        return reject({ err, stderr: stderr?.toString() || err.message });
      }
      console.log(`Command output: ${stdout?.toString().substring(0, 500)}...`);
      resolve(stdout?.toString() || '');
    });
  });
}

/**
 * Execute command silently (no logging)
 * @param {string} cmd - Command to execute
 * @param {Object} opts - Options
 * @returns {Promise<string>} - Command output
 */
async function runCmdSilent(cmd, opts = {}) {
  const cwd = opts.cwd || process.cwd();
  const timeout = opts.timeout || 300000;
  const maxBuffer = opts.maxBuffer || 1024 * 1024 * 20;

  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, maxBuffer, timeout });
    return (stdout || '') + (stderr ? '\n' + stderr : '');
  } catch (e) {
    const stderr = (e.stderr && e.stderr.toString()) || e.message || String(e);
    const error = new Error(stderr);
    error.stderr = stderr;
    throw error;
  }
}

module.exports = {
  runCmd,
  runCmdCallback,
  runCmdSilent,
  execAsync,
};
