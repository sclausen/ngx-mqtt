export function filterMatchesTopic(filterString: string, topic: string): boolean {
  if (filterString[0] === '#' && topic[0] === '$') {
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
        return t ? match() : false;
      default:
        return f === t && (f === undefined ? true : match());
    }
  };
  return match();
}
