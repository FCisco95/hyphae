export const isMemberStatus = (member: { status: string; is_member?: boolean }): boolean =>
  member.status === "member" ||
  member.status === "administrator" ||
  member.status === "creator" ||
  (member.status === "restricted" && member.is_member === true);
