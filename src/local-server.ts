import express from "express";
import { handler } from "./lambda/handler";
import type { APIGatewayProxyEventV2 } from "aws-lambda";

const app = express();
app.use(express.json());

function buildEvent(req: express.Request): APIGatewayProxyEventV2 {
  const sanitizedHeaders = Object.entries(req.headers).reduce<Record<string, string>>((acc, [key, value]) => {
    if (!value) {
      return acc;
    }
    acc[key] = Array.isArray(value) ? value.join(",") : value;
    return acc;
  }, {});

  const queryStringParameters =
    Object.keys(req.query ?? {}).length > 0 ? (req.query as Record<string, string>) : undefined;

  return {
    version: "2.0",
    routeKey: `${req.method} ${req.path}`,
    rawPath: req.path,
    rawQueryString: "",
    cookies: undefined,
    headers: {
      ...sanitizedHeaders,
      "content-type": req.headers["content-type"] ?? "application/json"
    },
    queryStringParameters,
    requestContext: {
      accountId: "local",
      apiId: "local",
      domainName: "localhost",
      domainPrefix: "localhost",
      http: {
        method: req.method,
        path: req.path,
        protocol: "HTTP/1.1",
        sourceIp: req.ip,
        userAgent: req.headers["user-agent"] ?? "local"
      },
      stage: "local",
      requestId: "local-request",
      routeKey: `${req.method} ${req.path}`,
      time: new Date().toISOString(),
      timeEpoch: Date.now()
    },
    body: JSON.stringify(req.body ?? null),
    isBase64Encoded: false,
    pathParameters: undefined,
    stageVariables: undefined,
    resource: req.path
  } as APIGatewayProxyEventV2;
}

app.post("/v1/images/generate", async (req, res) => {
  const event = buildEvent(req);
  const lambdaResult = await handler(event);
  res.status(lambdaResult.statusCode);
  Object.entries(lambdaResult.headers ?? {}).forEach(([key, value]) => {
    if (value) {
      res.setHeader(key, String(value));
    }
  });
  if (lambdaResult.body) {
    try {
      res.send(JSON.parse(lambdaResult.body));
    } catch (error) {
      res.send(lambdaResult.body);
    }
  } else {
    res.send();
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "local healthy" });
});

const port = Number(process.env.LOCAL_SERVER_PORT ?? 4000);
app.listen(port, () => {
  console.log(`Local server listening on http://localhost:${port}`);
});
