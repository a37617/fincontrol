export function formatCurrency(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateInput(dateStr) {
  if (!dateStr) return '';
  if (dateStr.includes('/')) {
    const [d, m, y] = dateStr.split('/');
    return `${y}-${m}-${d}`;
  }
  return dateStr;
}

export function getStatusLabel(status) {
  const map = { paid: 'Pago', pending: 'Pendente', overdue: 'Atrasado' };
  return map[status] || status;
}

export function getStatusClass(status) {
  const map = { paid: 'badge-paid', pending: 'badge-pending', overdue: 'badge-overdue' };
  return map[status] || 'badge-pending';
}

export function today() {
  return new Date().toISOString().split('T')[0];
}

export function adjustWeekend(dateStr) {
  if (!dateStr) return { date: dateStr, adjusted: false, dayName: '' };
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  const days = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  if (day === 6) {
    date.setDate(date.getDate() + 2);
    return { date: date.toISOString().split('T')[0], adjusted: true, dayName: 'Sábado', newDay: 'Segunda' };
  }
  if (day === 0) {
    date.setDate(date.getDate() + 1);
    return { date: date.toISOString().split('T')[0], adjusted: true, dayName: 'Domingo', newDay: 'Segunda' };
  }
  return { date: dateStr, adjusted: false, dayName: days[day] };
}

export function getDayName(dateStr) {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][date.getDay()];
}

export function isWeekend(dateStr) {
  if (!dateStr) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  const day = new Date(y, m - 1, d).getDay();
  return day === 0 || day === 6;
}

export const MONTHS_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export function monthLabel(monthStr) {
  if (!monthStr) return '';
  const [y, m] = monthStr.split('-');
  return `${MONTHS_PT[parseInt(m) - 1]} ${y}`;
}
