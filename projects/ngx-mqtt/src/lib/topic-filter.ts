export function filterMatchesTopic(filterString: string, topic: string): boolean {
  if ((filterString[0] === '#' || filterString[0] === '+') && topic[0] === '$') {
    return false;
  }
  const filterLevels = (filterString || '').split('/').reverse();
  const topicLevels = (topic || '').split('/').reverse();
  const match = (): boolean => {
    const f = filterLevels.pop();
    const t = topicLevels.pop();
    switch (f) {
      case '#':
        return true;
      case '+':
        return t !== undefined ? match() : false;
      default:
        return f === t && (f === undefined ? true : match());
    }
  };
  return match();
}

export function isValidTopicFilter(filter: string): boolean {
  if (filter === '' || filter.includes('\u0000')) {
    return false;
  }
  const levels = filter.split('/');
  return levels.every((level, index) => {
    if (level.includes('#')) {
      return level === '#' && index === levels.length - 1;
    }
    return !level.includes('+') || level === '+';
  });
}
