/** Support staff may manage conversations, but gain no other admin permissions. */
export function canManageSupport(role: string): boolean {
  return role === "ADMIN" || role === "SUPPORTER";
}
