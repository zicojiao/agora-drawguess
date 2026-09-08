const ADJECTIVES = [
  'Bouncy', 'Cosmic', 'Doodle', 'Electric', 'Fizzy', 'Happy', 'Jazzy', 'Lucky',
  'Mighty', 'Neon', 'Silly', 'Sunny', 'Turbo', 'Wiggly',
]

const NOUNS = [
  'Badger', 'Bunny', 'Dragon', 'Fox', 'Koala', 'Mango', 'Otter', 'Panda',
  'Penguin', 'Raccoon', 'Tiger', 'Wombat',
]

function randomIndex(length: number, random: () => number) {
  const value = Math.max(0, Math.min(0.999999, random()))
  return Math.floor(value * length)
}

export function createRandomNickname(previous = '', random = Math.random) {
  const adjective = ADJECTIVES[randomIndex(ADJECTIVES.length, random)]
  let nounIndex = randomIndex(NOUNS.length, random)
  let nickname = `${adjective} ${NOUNS[nounIndex]}`

  if (nickname.toLowerCase() === previous.trim().toLowerCase()) {
    nounIndex = (nounIndex + 1) % NOUNS.length
    nickname = `${adjective} ${NOUNS[nounIndex]}`
  }

  return nickname
}
