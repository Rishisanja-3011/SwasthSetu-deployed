const { spawn } = require('child_process');
const path = require('path');

const REPOSITORY_ROOT = path.resolve(__dirname, '../../../../');
const BRIDGE_PATH = path.join(REPOSITORY_ROOT, 'extraction', 'bridge.py');
const EXTRACTION_TIMEOUT_MS = Number(process.env.EXTRACTION_TIMEOUT_MS || 180000);

function runExtraction(filePath) {
  return new Promise((resolve, reject) => {
    const executable = process.env.PYTHON_EXECUTABLE
      || (process.platform === 'win32' ? 'python' : 'python3');
    const child = spawn(executable, [BRIDGE_PATH, filePath], {
      cwd: REPOSITORY_ROOT,
      env: { ...process.env, PYTHONPATH: REPOSITORY_ROOT },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      child.kill('SIGTERM');
      const error = new Error('EXTRACTION_TIMEOUT');
      error.code = 'EXTRACTION_TIMEOUT';
      settled = true;
      reject(error);
    }, EXTRACTION_TIMEOUT_MS);

    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (error) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      error.code = error.code === 'ENOENT' ? 'EXTRACTION_RUNTIME_UNAVAILABLE' : 'EXTRACTION_RUNTIME_FAILED';
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (settled) return;
      settled = true;
      if (code !== 0) {
        const error = new Error(stderr.trim() || `Extraction process exited with code ${code}.`);
        error.code = /ModuleNotFoundError|ImportError|No module named/i.test(stderr)
          ? 'EXTRACTION_RUNTIME_UNAVAILABLE'
          : 'EXTRACTION_FAILED';
        reject(error);
        return;
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        error.message = `Extraction returned invalid JSON: ${error.message}`;
        error.code = 'EXTRACTION_INVALID_RESPONSE';
        reject(error);
      }
    });
  });
}

module.exports = { runExtraction };
