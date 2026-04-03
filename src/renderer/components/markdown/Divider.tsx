import type { FC, HTMLAttributes } from 'react';

type DividerProps = HTMLAttributes<HTMLHRElement>;

export const Divider: FC<DividerProps> = (props) => <hr className="divider" {...props} />;
