export type Theme = {
  readonly name: string;
  readonly fonts: {
    readonly body: string;
    readonly code: string;
    readonly bodySize: string;
    readonly codeSize: string;
    readonly lineHeight: string;
    readonly codeLineHeight: string;
  };
  readonly colors: {
    readonly bg: string;
    readonly text: string;
    readonly textSecondary: string;
    readonly heading: string;
    readonly link: string;
    readonly linkHover: string;
    readonly codeBg: string;
    readonly codeText: string;
    readonly blockquoteBg: string;
    readonly blockquoteBorder: string;
    readonly blockquoteText: string;
    readonly tableBorder: string;
    readonly tableHeaderBg: string;
    readonly tableStripeBg: string;
    readonly divider: string;
    readonly selection: string;
  };
  readonly spacing: {
    readonly paragraph: string;
    readonly headingMarginTop: string;
    readonly headingMarginBottom: string;
    readonly contentMaxWidth: string;
    readonly contentPadding: string;
  };
  readonly headingScale: {
    readonly h1: string;
    readonly h2: string;
    readonly h3: string;
    readonly h4: string;
    readonly h5: string;
    readonly h6: string;
  };
};
