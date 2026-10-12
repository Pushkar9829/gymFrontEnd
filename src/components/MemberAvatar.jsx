import clsx from 'clsx';
import { Avatar, AVATAR_SIZES } from './ui';
import { PrivateImage } from './PrivateImage';

/**
 * A member's photo. New photos are private files (loaded with the login token, small version only);
 * older members may still have a public photo link, shown as before. Falls back to initials.
 * own = the member app showing the member their own photo (uses the member client).
 */
export function MemberAvatar({ member, size = 'md', client, own = false }) {
  const name = member?.name || '?';
  if (member?.photoFileId) {
    return (
      <PrivateImage
        id={member.photoFileId}
        url={own ? `/me/files/${member.photoFileId}` : undefined}
        client={client}
        thumb
        alt={name}
        className={clsx('shrink-0 rounded-full', AVATAR_SIZES[size])}
        fallback={<Avatar name={name} size={size} />}
      />
    );
  }
  return <Avatar name={name} src={member?.photoUrl} size={size} />;
}
