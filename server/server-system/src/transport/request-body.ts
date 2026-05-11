import type { IncomingMessage } from "node:http";

export async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  let body = "";

  for await (const chunk of request) {
    body += chunk;
  }

  return body ? JSON.parse(body) : {};
}