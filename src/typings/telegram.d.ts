export interface TelegramResponse {
  ok: boolean
  error_code?: number
  description?: string
}

export interface TelegramMessage {
  message_id: number
  date: number
  text: string
  sender_chat?: {
    id: number
    title: string
    type: 'channel'
  }
  chat: {
    id: number
    title: string
    type: 'channel' | 'private'
  }
  from: {
    id: number
    is_bot: boolean
    first_name: string
    username: string
    language_code: string
  }
}

export interface TelegramSendMessageOptional {
  parse_mode: 'Markdown' | 'MarkdownV2' | 'HTML'
}

export interface TelegramSendMessageResponse extends TelegramResponse {
  result: TelegramMessage
}

export interface TelegramGetUpdateResponse extends TelegramResponse {
  result: Array<{
    update_id: number
    message?: TelegramMessage
  }>
}