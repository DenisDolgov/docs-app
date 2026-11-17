// Комментарий, которого нет или на который нет права, отвечает одинаково:
// иначе `commentId` перебирается и выдаёт существование чужих обсуждений.
export const COMMENT_NOT_FOUND_ERROR = 'Comment not found';

export const COMMENT_FORBIDDEN_ERROR = 'You cannot modify this comment';
export const COMMENT_ROOT_ONLY_ERROR = 'Only root comments can be resolved';
export const COMMENT_REPLY_DEPTH_ERROR =
  'Replies are allowed only on root comments';
export const COMMENT_PARENT_DOCUMENT_ERROR =
  'Parent comment belongs to another document';
export const COMMENT_ANCHOR_ERROR = 'Invalid comment anchor';
