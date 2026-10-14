const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

const REPORT_STORAGE_ROOT = path.resolve(
  process.env.REPORT_STORAGE_ROOT || path.join(__dirname, '../../storage/report-files'),
);
const MAX_PDF_BYTES = 10 * 1024 * 1024;

function decodeOriginalPdf({ file_base64, file_name, file_mime_type }) {
  if (typeof file_base64 !== 'string' || !file_base64) {
    throw new Error('ORIGINAL_REPORT_FILE_REQUIRED');
  }
  if (file_mime_type && file_mime_type !== 'application/pdf') {
    throw new Error('ORIGINAL_REPORT_MUST_BE_PDF');
  }
  const payload = file_base64.replace(/^data:application\/pdf;base64,/, '');
  if (payload.length > Math.ceil(MAX_PDF_BYTES / 3) * 4) {
    throw new Error('ORIGINAL_REPORT_FILE_SIZE_INVALID');
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(payload)) {
    throw new Error('ORIGINAL_REPORT_ENCODING_INVALID');
  }
  const bytes = Buffer.from(payload, 'base64');
  if (!bytes.length || bytes.length > MAX_PDF_BYTES) {
    throw new Error('ORIGINAL_REPORT_FILE_SIZE_INVALID');
  }
  if (bytes.subarray(0, 5).toString() !== '%PDF-') {
    throw new Error('ORIGINAL_REPORT_PDF_INVALID');
  }
  const filename = path.basename(String(file_name || 'laboratory-report.pdf').replace(/\\/g, '/'))
    .replace(/[\x00-\x1f\x7f]/g, '').slice(0, 180) || 'laboratory-report.pdf';
  return { bytes, filename, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
}

async function storeOriginalPdf(reportId, file) {
  const storageKey = `${reportId}-${file.sha256}.pdf`;
  await fs.mkdir(REPORT_STORAGE_ROOT, { recursive: true });
  await fs.writeFile(path.join(REPORT_STORAGE_ROOT, storageKey), file.bytes, { flag: 'wx', mode: 0o600 });
  return {
    report_id: reportId,
    storage_key: storageKey,
    original_file_path: storageKey,
    original_file_name: file.filename,
    mime_type: 'application/pdf',
    byte_size: file.bytes.length,
    sha256: file.sha256,
  };
}

function originalFilePath(file) {
  if (!file?.storage_key || path.basename(file.storage_key) !== file.storage_key || file.storage_key.includes('\\')) {
    throw new Error('INVALID_REPORT_STORAGE_PATH');
  }
  return path.join(REPORT_STORAGE_ROOT, file.storage_key);
}

async function removeOriginalPdf(file) {
  await fs.unlink(originalFilePath(file)).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

function downloadOriginalPdf(res, file) {
  const absolutePath = originalFilePath(file);
  return res.download(absolutePath, file.original_file_name, (error) => {
    if (error && !res.headersSent) {
      res.status(error.code === 'ENOENT' ? 404 : 500).json({
        success: false,
        error: 'ORIGINAL_REPORT_DOWNLOAD_FAILED',
      });
    }
  });
}

module.exports = {
  decodeOriginalPdf,
  storeOriginalPdf,
  originalFilePath,
  removeOriginalPdf,
  downloadOriginalPdf,
};
