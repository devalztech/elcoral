/**
 * One place that decides what a follow button says.
 *
 *   you follow them + they follow you .... Friends   (tap = unfollow)
 *   you follow them ...................... Following (tap = unfollow)
 *   they follow you ...................... Follow back
 *   neither .............................. Follow
 *
 * After tapping "Friends" the relationship becomes one-way (they still
 * follow you), so the very same button re-renders as "Follow back" —
 * which is exactly the behaviour asked for.
 */
export function followLabel(isFollowing, followsYou) {
  if (isFollowing) return followsYou ? 'Friends' : 'Following'
  return followsYou ? 'Follow back' : 'Follow'
}
