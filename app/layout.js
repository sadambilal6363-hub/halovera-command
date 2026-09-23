import './globals.css';

export const metadata = {
  title: 'Halovera Command',
  description: 'مركز قيادة هلوفيرا وإدارة العملاء والمشاريع',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
