export type CommentPermissionAccount = {
  isPremium: boolean;
};

export function canCommentOnDiscoverPost(account: CommentPermissionAccount) {
  return account.isPremium;
}

export type CommentAuthor = {
  authorId?: string;
  username: string;
};

export type CommentPostOwner = {
  kind: "post";
  authorId?: string;
  username: string;
};

export type CommentArtworkOwner = {
  kind: "artwork";
  ownerId?: string;
  uploaderUsername?: string;
  artistName?: string;
};

export type CommentContentOwner = CommentPostOwner | CommentArtworkOwner;

export type CommentDeleteAccount = {
  uid?: string | null;
  username: string;
  displayName?: string;
};

export function canDeleteComment(
  comment: CommentAuthor,
  owner: CommentContentOwner,
  account: CommentDeleteAccount
) {
  const isCommentAuthor =
    Boolean(account.uid && comment.authorId && comment.authorId === account.uid) ||
    comment.username.trim().toLocaleLowerCase("tr") === account.username.trim().toLocaleLowerCase("tr");

  if (isCommentAuthor) return true;

  if (owner.kind === "post") {
    if (account.uid && owner.authorId && owner.authorId === account.uid) return true;
    return owner.username.trim().toLocaleLowerCase("tr") === account.username.trim().toLocaleLowerCase("tr");
  }

  if (account.uid && owner.ownerId && owner.ownerId === account.uid) return true;
  if (owner.uploaderUsername && owner.uploaderUsername.trim().toLocaleLowerCase("tr") === account.username.trim().toLocaleLowerCase("tr")) {
    return true;
  }
  if (account.displayName && owner.artistName && owner.artistName.trim().toLocaleLowerCase("tr") === account.displayName.trim().toLocaleLowerCase("tr")) {
    return true;
  }
  return false;
}

export const DISCOVER_COMMENT_EDIT_WINDOW_MS = 3 * 60 * 1000;

export function isDiscoverCommentAuthor(
  comment: CommentAuthor,
  account: CommentDeleteAccount
) {
  if (account.uid && comment.authorId && comment.authorId === account.uid) return true;
  return comment.username.trim().toLocaleLowerCase("tr") === account.username.trim().toLocaleLowerCase("tr");
}

export function canEditDiscoverComment(
  comment: CommentAuthor & { createdAt: number; editedAt?: number },
  account: CommentDeleteAccount
) {
  if (!isDiscoverCommentAuthor(comment, account)) return false;
  if (comment.editedAt) return false;
  return Date.now() - comment.createdAt < DISCOVER_COMMENT_EDIT_WINDOW_MS;
}
