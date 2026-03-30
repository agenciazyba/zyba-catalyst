function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token"
  });
  res.end(JSON.stringify(data, null, 2));
}

function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    const MAX_PAYLOAD_SIZE = 2 * 1024 * 1024; // 2MB

    req.on("data", (chunk) => {
      body += chunk.toString();
      if (Buffer.byteLength(body, "utf8") > MAX_PAYLOAD_SIZE) {
        req.destroy();
        reject(new Error("Payload Too Large"));
      }
    });

    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });

    req.on("error", reject);
  });
}

module.exports = {
  sendJson,
  getRequestBody
};