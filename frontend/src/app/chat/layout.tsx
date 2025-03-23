//frontend/src/app/chat/layout.tsx
import ChatLayout from '../../components/chat/chat-layout';

export default function Layout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <ChatLayout>{children}</ChatLayout>;
}
