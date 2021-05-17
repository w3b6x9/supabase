import Layout from '~/components/Layout'
import Message from '~/components/Message'
import MessageInput from '~/components/MessageInput'
import TypingUsers from '~/components/TypingUsers'
import { useRouter } from 'next/router'
import { useStore, addMessage } from '~/lib/Store'
import { useContext, useEffect, useRef } from 'react'
import UserContext from '~/lib/UserContext'

const ChannelsPage = (props) => {
  const router = useRouter()
  const { user } = useContext(UserContext)
  const messagesEndRef = useRef(null)

  // Else load up the page
  const { id: channelId } = router.query
  const { messages, channels, users, onDebouncedKeyDown, onDebouncedKeyUp } = useStore({ user, channelId })

  useEffect(() => {
    messagesEndRef.current.scrollIntoView({
      block: 'start',
      behavior: 'smooth',
    })
  }, [messages])

  // Render the channels and messages
  return (
    <Layout channels={channels} activeChannelId={channelId} users={users}>
      <div className="relative h-screen">
        <div className="Messages h-full pb-20">
          <div className="p-2 overflow-y-auto">
            {messages.map((x) => (
              <Message key={x.id} message={x} />
            ))}
            <div ref={messagesEndRef} style={{ height: 0 }} />
          </div>
        </div>
        <div className="p-2 absolute bottom-0 left-0 w-full">
          <MessageInput onSubmit={async (text) => addMessage(text, channelId, user.id)} onDebouncedKeyDown={onDebouncedKeyDown} onDebouncedKeyUp={onDebouncedKeyUp} />
          <TypingUsers users={users} />
        </div>
      </div>
    </Layout>
  )
}

export default ChannelsPage
