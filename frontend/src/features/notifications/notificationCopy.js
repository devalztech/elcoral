/**
 * One place that turns a notification row into a human sentence.
 *
 * Both the notifications page and the browser (system) alert read from
 * here, so a repost never shows up as "sent a message" in one surface
 * and "reposted your post" in the other.
 */
export const NOTIFICATION_TEXT = {
  post_like: 'liked your post',
  comment_like: 'liked your comment',
  comment: 'commented on your post',
  reply: 'replied to you',
  follow: 'started following you',
  mention: 'mentioned you',
  repost: 'reposted your post',
  message: 'sent you a message',
}

export function notificationSentence(n) {
  const who = n?.actor?.full_name || n?.actor?.username || 'Someone'
  const what = NOTIFICATION_TEXT[n?.kind] ?? 'sent you an update'
  return `${who} ${what}`
}
