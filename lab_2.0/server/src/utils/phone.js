function normalizePhone(phone) {
  if (typeof phone !== 'string') return '';

  const trimmed = phone.trim();
  if (!trimmed) return '';

  const hasPlus = trimmed.startsWith('+');
  const digits = trimmed.replace(/\D/g, '');
  return digits ? `${hasPlus ? '+' : ''}${digits}` : '';
}

module.exports = { normalizePhone };
