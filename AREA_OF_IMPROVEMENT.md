# Area of Improvement

Document to capture follow-up ideas, technical debt, and next-phase investments.

1. **Authenticate gateway** – Move from the single shared `x-api-key` to API Gateway usage plans with API keys or integrate Amazon Cognito to handle per-user authentication, token rotation, and scoped access.
2. **Rate limiting** – Track requests per API key, per IP, and/or overall rate limits (p95) to avoid quota overages; enforce the limits at the gateway, Lambda middleware, or via a Redis-backed token bucket.
3. **Custom domain** – Attach a vanity domain, configure TLS via ACM, and optionally put CloudFront in front of the API Gateway for lower latency and HTTPS termination closer to end users.
4. **Async flow** – Push long-running jobs into ECS or AWS Batch workers; return immediate job IDs with polling (or leverage SSE/WebSockets) for updates instead of keeping the Lambda synchronous.
5. **Node.js improvements** – Introduce structured logging (e.g., pino), better envelope errors, enforce lint rules, and consider refactoring the handler/service separation for easier unit testing and reusability.
6. **Modular Terraform** – Split the Terraform config into reusable modules (Lambda, S3, API Gateway, IAM) so environments can be composed more cleanly and reused for staging/prod.
7. **Secret Manager** – Store `GEMINI_API_KEY` and other secrets in AWS Secrets Manager (or Parameter Store) and let the Lambda read them via IAM; avoid injecting secrets directly through environment variables.
8. **Git hooks** – Add Husky or a similar tool for pre-commit formatting/linting and pre-push test runners to catch issues early.
9. **Unit tests** – Add Jest/ts-jest coverage for the handler, services, and helpers; mock the Gemini client to keep tests fast and deterministic.
10. **Integration tests** – Scripted local or CI tests that spin up the handler (via `local-server.ts` or Lambda invocation) and mock Gemini/S3 interactions to verify end-to-end flow.
11. **CI/CD** – Add GitHub Actions (or equivalent) to run lint/build/tests on pull requests, publish `lambda.zip`, and optionally deploy to a staging environment after approvals.
12. **Observability & metrics** – Publish custom CloudWatch metrics/traces (invocation counts, downstream latency), and optionally stream logs to a central monitoring system so failures are easier to detect.
13. **Cost controls** – Alert when S3 storage or Lambda durations exceed baselines, and consider throttling image sizes to control Gemini usage costs.
14. **Reference image management** – Validate/resize reference images before sending them to Gemini to avoid API failures and reduce payload size.
15. **Signed URLs & retention** – Generate temporary signed URLs for downloaded images to avoid exposing buckets, and define lifecycle/retention rules on `generated` objects to control storage costs and compliance.
16. **Add database support** – Introduce lightweight persistence (DynamoDB/Postgres) for job metadata, analytics, or request throttling instead of relying solely on in-memory Lambda state.
17. **Quota enforcement** – Track Gemini consumption in a durable store, cap calls per minute/hour/day, and fail fast when the configured budget is exhausted; optionally emit metrics/alerts when the remaining quota drops below a threshold to prevent surprise billing.
