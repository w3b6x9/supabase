import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Socket, Presence } from "phoenix"
import { useDebouncedCallback } from 'use-debounce'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_KEY
)

/**
 * @param {number} channelId the currently selected Channel
 * @param {object} user current user
 */
export const useStore = (props) => {
  const [users, setUsers] = useState(new Map())
  const [channels, setChannels] = useState([])
  const [messages, setMessages] = useState([])
  const [socket, setSocket] = useState()
  const [typingIndicatiorChannel, setTypingIndicatorChannel] = useState()

  const updateUser = (userId, user) => {
    setUsers((prevUsers) => {
      const existingUser = prevUsers.get(userId) || {}
      return new Map(prevUsers).set(userId, { ...existingUser, ...user })
    });
  }

  const onDebouncedKeyDown = useDebouncedCallback(
    () => {
      const currentUserId = props.user?.id
      onDebouncedKeyUp.cancel()
      currentUserId && typingIndicatiorChannel?.push('typing_indicator', { user_id: currentUserId, is_typing: true })
    },
    600,
    { leading: true, trailing: false }
  )

  const onDebouncedKeyUp = useDebouncedCallback(
    () => {
      const currentUserId = props.user?.id
      onDebouncedKeyDown.cancel()
      currentUserId && typingIndicatiorChannel?.push('typing_indicator', { user_id: currentUserId, is_typing: false })
    },
    600
  )

  // Fetch initial data
  useEffect(() => {
    Promise.all([fetchChannels(setChannels), fetchUsers(updateUser)])
    .catch(error => console.log('error', error));
  }, [])

  // Connect to socket and get presence info
  useEffect(() => {
    let socket
    let userPresenceChannel
    const currentUserId = props.user?.id

    if (!currentUserId) return

    socket = new Socket("wss://multiplayer-dev.fly.dev/socket", {
      params: { user_id: currentUserId },
    })
    socket.connect()
    setSocket(socket)

    userPresenceChannel = socket.channel("room:user_presence")
    userPresenceChannel.join()

    const userPresence = new Presence(userPresenceChannel)

    userPresence.onLeave((userId, current, _leftPres) => {
      current.metas.length === 0 && updateUser(userId, { status: 'OFFLINE', isTyping: false })
    })

    userPresence.onSync(() => {
      userPresence.list().forEach(({ metas }) => {
        const userId = metas[0]?.user_id
        userId && updateUser(userId, { status: 'ONLINE' })
      })
    })

    return () => {
      userPresenceChannel && userPresenceChannel.leave()
      socket && socket.disconnect()
    }
  }, [props.user?.id])

  // Set up listeners
  useEffect(() => {
    if (!props.channelId) return

    // Listen for new messages
    const messageEvent = 'messages:channel_id=eq.' + props.channelId
    const messageListener = supabase
      .from(messageEvent)
      .on('INSERT', (payload) => {
        const message = payload.new
        const authorId = message.user_id
        if (!users.get(authorId)) {
          fetchUser(authorId, updateUser)
        }
        setMessages(prevMessage => prevMessage.concat(message))
      })
      .subscribe()

    // Listen for changes to our users
    const userListener = supabase
      .from('users')
      .on('*', (payload) => {
        const user = payload.new
        updateUser(user.id, (({ id, username }) => ({ id, username }))(user))
      })
      .subscribe()

    // Listen for new channels
    const channelListener = supabase
      .from('channels')
      .on('INSERT', (payload) => {
        setChannels(prevChannels => prevChannels.concat(payload.new))
      })
      .subscribe()

    // Cleanup on unmount
    return () => {
      messageListener.unsubscribe()
      userListener.unsubscribe()
      channelListener.unsubscribe()
    }
  }, [props.channelId])

  // Update when the route changes
  useEffect(() => {
    let typingIndicatiorChannel

    if (!props.channelId || socket?.conn?.readyState !== 1) return

    fetchMessages(props.channelId, setMessages)

    typingIndicatiorChannel = socket.channel("room:typing_indicator:" + props.channelId)
    typingIndicatiorChannel.on('typing_indicator', payload => {
      updateUser(payload.user_id, { isTyping: payload.is_typing })
    })
    typingIndicatiorChannel.join()
    setTypingIndicatorChannel(typingIndicatiorChannel)

    return () => {
      onDebouncedKeyDown.cancel
      onDebouncedKeyUp.cancel
      typingIndicatiorChannel && typingIndicatiorChannel.leave()
    }
  }, [props.channelId, socket?.conn?.readyState])

  return {
    // We can export computed values here to map the authors to each message
    messages: messages.map((x) => ({ ...x, author: users.get(x.user_id) })),
    channels: channels.sort((a, b) => a.slug.localeCompare(b.slug)),
    users: [...users.values()].filter(user => user.id && user.username).sort((a, b) => a.username.localeCompare(b.username)),
    onDebouncedKeyDown,
    onDebouncedKeyUp
  }
}

/**
 * Fetch all channels
 * @param {function} setState Optionally pass in a hook or callback to set the state
 */
export const fetchChannels = async (setState) => {
  try {
    let { body } = await supabase.from('channels').select('*')
    if (setState) setState(body)
    return body
  } catch (error) {
    console.log('error', error)
  }
}

/**
 * Fetch all users
 * @param {function} setState Optionally pass in a hook or callback to set the state
 */
 export const fetchUsers = async (setState) => {
  try {
    let { body } = await supabase.from('users').select('id, username')
    body.forEach(user => setState(user.id, user))
    return body
  } catch (error) {
    console.log('error', error)
  }
}

/**
 * Fetch a single user
 * @param {number} userId
 * @param {function} setState Optionally pass in a hook or callback to set the state
 */
export const fetchUser = async (userId, setState) => {
  try {
    let { body } = await supabase.from('users').select(`id, username`).eq('id', userId)
    let user = body[0]
    if (setState) setState(user.id, user)
    return user
  } catch (error) {
    console.log('error', error)
  }
}

/**
 * Fetch all messages and their authors
 * @param {number} channelId
 * @param {function} setState Optionally pass in a hook or callback to set the state
 */
export const fetchMessages = async (channelId, setState) => {
  try {
    let { body } = await supabase
      .from('messages')
      .select(`*, author:user_id(*)`)
      .eq('channel_id', channelId)
      .order('inserted_at', true)
    if (setState) setState(body)
    return body
  } catch (error) {
    console.log('error', error)
  }
}

/**
 * Insert a new channel into the DB
 * @param {string} slug The channel name
 */
export const addChannel = async (slug) => {
  try {
    let { body } = await supabase.from('channels').insert([{ slug }])
    return body
  } catch (error) {
    console.log('error', error)
  }
}

/**
 * Insert a new message into the DB
 * @param {string} message The message text
 * @param {number} channel_id
 * @param {number} user_id The author
 */
export const addMessage = async (message, channel_id, user_id) => {
  try {
    let { body } = await supabase.from('messages').insert([{ message, channel_id, user_id }])
    return body
  } catch (error) {
    console.log('error', error)
  }
}
