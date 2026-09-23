/** Only standalone execution requests bypass the AI editor. */
export function runtimeCommand(input: string): "npm run build" | "preview" | "stop" | null {
  const text = input.trim().toLowerCase().replace(/[.!?]+$/, "").replace(/^(?:please|te molam|те молам)\s+/, "");
  if (/^(?:(?:please|can you|could you)\s+)?(?:npm run build|run (?:the )?build|build|napravi (?:run )?build|направи (?:run )?build)(?:\s+(?:and|i|и)\s+(?:open|otvori|отвори)(?: go| го)?(?: na| на)?\s+(?:preview|localhost(?::3000)?))?$/.test(text)) return "npm run build";
  if (/^(?:preview|npm run (?:dev|preview|start)|npm start|open (?:the )?(?:preview|localhost(?::3000)?)|(?:otvori|отвори)(?: go| го)?(?: na| на)? (?:preview|localhost(?::3000)?)|start (?:the )?(?:server|preview))$/.test(text)) return "preview";
  if (/^(?:run it|run the project|start the project|give me (?:a )?preview(?: run it)?|show (?:me )?(?:a |the )?preview|pusti go|пушти го)$/.test(text)) return "preview";
  if (/^(?:stop|stop preview|stop server)$/.test(text)) return "stop";
  return null;
}

export function runtimePath(path: string): string {
  if (!path || path.startsWith("/") || path.includes("\\") || path.split("/").some((part) => !part || part === "." || part === "..") || /[\x00-\x1f]/.test(path)) {
    throw new Error("Invalid project file path.");
  }
  return `/home/user/project/${path}`;
}
