import type { FC } from 'react';

type ImageProps = {
  readonly src: string;
  readonly alt?: string;
};

export const Image: FC<ImageProps> = ({ src, alt }) => (
  <img className="image" src={src} alt={alt ?? ''} loading="lazy" />
);
