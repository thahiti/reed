type FileSender = (filePath: string) => void;

type OpenFileQueue = {
  readonly enqueue: (filePath: string) => void;
  readonly setSender: (sender: FileSender) => void;
  readonly resetSender: () => void;
  readonly drain: () => ReadonlyArray<string>;
};

export const createOpenFileQueue = (): OpenFileQueue => {
  const pending: string[] = [];
  let sender: FileSender | null = null;

  return {
    enqueue: (filePath: string) => {
      if (sender) {
        sender(filePath);
      } else {
        pending.push(filePath);
      }
    },
    setSender: (s: FileSender) => {
      sender = s;
      pending.forEach((filePath) => { s(filePath); });
      pending.length = 0;
    },
    resetSender: () => { sender = null; },
    drain: () => [...pending],
  };
};
