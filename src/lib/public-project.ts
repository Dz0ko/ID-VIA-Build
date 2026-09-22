export function publicProject<T extends { envEncrypted: string | null }>(project: T): Omit<T, "envEncrypted"> {
  const { envEncrypted, ...safe } = project;
  void envEncrypted;
  return safe;
}
