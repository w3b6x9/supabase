const TypingUsers = ({ users }) => {
  let userTypingText = ''
  const typingUsers = users.reduce((acc, user) => user.isTyping ? acc.push(user.username) && acc : acc, [])
  const typingUsersCount = typingUsers.length

  if (typingUsersCount >= 1) {
    userTypingText = typingUsers.join(', ')
    userTypingText = typingUsersCount === 1 ? userTypingText + ' is typing' : userTypingText + ' are typing'
  }

  return (
    <div className="h-5 p-0.5 text-sm text-white overflow-auto">
      {userTypingText}
    </div>
  )
}

export default TypingUsers
