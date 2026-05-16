export const allMermaidSettled = (root: ParentNode): boolean => {
  const diagrams = Array.from(
    root.querySelectorAll('[data-testid="mermaid-diagram"]'),
  );
  return diagrams.every((d) => d.querySelector('svg') !== null);
};
