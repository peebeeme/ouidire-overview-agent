import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OuiDire — Overview Agent",
  description: "Multi-level document analysis for psychiatric and legal record audit",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#0f0f0f", color: "#f0f0f0" }}>
        <style>{`
          .site-header {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 4px;
            padding: 12px 20px;
          }
          .site-header-meta {
            font-size: 10px;
            line-height: 1.4;
            white-space: normal;
            word-break: break-word;
            min-width: 0;
          }
          @media (min-width: 640px) {
            .site-header {
              flex-direction: row;
              align-items: center;
              justify-content: space-between;
              padding: 14px 40px;
            }
            .site-header-meta {
              font-size: 11px;
              white-space: nowrap;
            }
          }
        `}</style>
        {children}
      </body>
    </html>
  );
}
