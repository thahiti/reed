import type { FC } from 'react';

export const Welcome: FC = () => (
  <div className="welcome">
    <h1 className="welcome-title">Reed</h1>
    <p className="welcome-subtitle">마크다운 파일을 열어보세요</p>
    <p className="welcome-hint">Cmd+O로 파일 열기 · Cmd+P로 최근 파일 검색</p>
  </div>
);
