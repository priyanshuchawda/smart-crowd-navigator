import { createServer } from "node:http";

const port = Number(process.env.PORT ?? 8080);

const server = createServer((_request, response) => {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(
    JSON.stringify({
      service: "Smart Crowd Navigator API",
      status: "ok",
      engineVersion: "scaffold",
    }),
  );
});

if (process.env.NODE_ENV !== "test") {
  server.listen(port, () => {
    console.log(`assistant-api listening on http://localhost:${port}`);
  });
}

export { server };
