export function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDateOnly(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function labelize(value) {
  if (!value) return '—';
  return String(value).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function roleLabel(role) {
  const map = {
    citizen: 'Citizen',
    officer: 'Officer',
    department_head: 'Department Head',
    admin: 'Administrator',
  };
  return map[role] || labelize(role);
}

export function displayName(ref) {
  if (!ref) return '—';
  if (typeof ref === 'string') return ref;
  return ref.name || ref.code || ref.email || '—';
}

export function idOf(ref) {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  return ref._id || '';
}
