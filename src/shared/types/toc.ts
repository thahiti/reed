export type TocHeadingLevel = 1 | 2 | 3 | 4 | 5 | 6;

export type TocHeading = {
  readonly level: TocHeadingLevel;
  readonly id: string;
  readonly text: string;
};

export type TocPosition = 'left' | 'right';

export type TocSettings = {
  readonly position: TocPosition;
  readonly minLevel: TocHeadingLevel;
  readonly maxLevel: TocHeadingLevel;
  readonly visible: boolean;
};

export const defaultTocSettings: TocSettings = {
  position: 'right',
  minLevel: 2,
  maxLevel: 4,
  visible: false,
};
