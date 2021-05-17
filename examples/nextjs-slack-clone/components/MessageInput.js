import { useState } from 'react'

const MessageInput = ({ onSubmit, onDebouncedKeyDown, onDebouncedKeyUp }) => {
  const [messageText, setMessageText] = useState('')

  const onKeyDown = event => {    
    // Watch for enter key
    switch(event.keyCode) {
      case 9:
        break;
      case 13:
        onDebouncedKeyUp.flush()
        onSubmit(messageText)
        setMessageText('')
        break;
      default:
        onDebouncedKeyDown()
    }
  }

  const onKeyUp = event => {    
    switch(event.keyCode) {
      case 13:
        onDebouncedKeyUp.cancel()
        break;
      default:
        onDebouncedKeyUp()
    }
  }

  return (
    <>
      <input
        className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
        type="text"
        placeholder="Send a message"
        value={messageText}
        onChange={(e) => setMessageText(e.target.value)}
        onKeyDown={(e) => onKeyDown(e)}
        onKeyUp={(e) => onKeyUp(e)}
      />
    </>
  )
}

export default MessageInput
