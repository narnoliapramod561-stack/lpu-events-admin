export function formatEventDate(date: string) {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(date));
}

export function formatEventDateRange(startDate: string, endDate: string) {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const sameDay = start.toDateString() === end.toDateString();

  if (sameDay) {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(start);
  }

  return `${formatEventDate(startDate)} - ${new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(end)}`;
}

export function formatEventTime(date: string) {
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(date));
}

export function formatEventTimeRange(startDate: string, endDate: string) {
  return `${formatEventTime(startDate)} - ${formatEventTime(endDate)}`;
}

export function formatPrice(price: number | null) {
  if (price === null) {
    return 'TBA';
  }

  if (price === 0) {
    return 'FREE';
  }

  return `₹${Math.round(price)}`;
}

export function formatSeats(stockAvailable: number) {
  if (stockAvailable === 1) {
    return '1 seat left';
  }

  return `${stockAvailable} seats left`;
}
