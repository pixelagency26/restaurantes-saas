import ChatFlotante from '@/components/ChatFlotante'

export default function DomiLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <ChatFlotante />
    </>
  )
}
