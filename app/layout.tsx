import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "OuiDire — Overview Agent",
  description: "Multi-level document analysis for psychiatric and legal record audit",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, background: "#0f0f0f", color: "#f0f0f0" }}>
        {children}
      </body>
    </html>
  );
}
