import type { FC } from 'react';

type CheckboxProps = {
  readonly checked: boolean;
};

export const Checkbox: FC<CheckboxProps> = ({ checked }) => (
  <input type="checkbox" checked={checked} readOnly className="checkbox" />
);
