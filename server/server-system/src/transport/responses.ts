import type { ServerResponse } from "node:http";

export function sendJson(response: ServerResponse, payload: unknown, statusCode = 200): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    ...corsHeaders()
  });
  response.end(statusCode === 204 ? undefined : JSON.stringify(payload, null, 2));
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  };
}