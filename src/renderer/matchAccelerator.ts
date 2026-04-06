export const matchAccelerator = (
  e: KeyboardEvent,
  accelerator: string,
  isMac: boolean,
): boolean => {
  const parts = accelerator.toLowerCase().split('+');
  const key = parts[parts.length - 1] ?? '';

  const needCmd =
    parts.includes('cmdorctrl') || parts.includes('cmd') || parts.includes('command');
  const needCtrl = parts.includes('ctrl') || parts.includes('control');
  const needShift = parts.includes('shift');
  const needAlt = parts.includes('alt') || parts.includes('option');

  const modifierMatch = isMac
    ? (needCmd ? e.metaKey : !e.metaKey) && (needCtrl ? e.ctrlKey : !e.ctrlKey)
    : (needCmd || needCtrl ? e.ctrlKey : !e.ctrlKey) && !e.metaKey;

  const shiftMatch = needShift ? e.shiftKey : !e.shiftKey;
  const altMatch = needAlt ? e.altKey : !e.altKey;

  const eventKey = e.key.toLowerCase();
  const keyMatch =
    key === ',' ? eventKey === ',' :
    key === '.' ? eventKey === '.' :
    key === '/' ? eventKey === '/' :
    key === eventKey;

  return modifierMatch && shiftMatch && altMatch && keyMatch;
};
