interface TypeObject<T> {
  [key: string]: T
}
type MessageStatus = 'ready' | 'ok' | 'wait' | 'no'