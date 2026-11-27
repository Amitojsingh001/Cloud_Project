# Campus Issue Reporting and Tracking System

**Course:** UCS531 – Cloud Computing  
**Project type:** Serverless campus application  
**Team members:** Add names and roll numbers before submission

## 1. Problem and objectives

The Campus Issue Tracker gives students a browser-based form to report campus problems and look up submitted complaints using a student ID. The admin dashboard lists complaints and lets a reviewer change each status. The deployed classroom demo uses fictional student information only.

## 2. Deployed architecture

| AWS service | Responsibility |
|---|---|
| Amazon S3 | Hosts the static student portal and admin dashboard |
| Amazon API Gateway REST API | Provides HTTPS endpoints, CORS support, and request throttling |
| Amazon DynamoDB | Stores complaint records in an existing on-demand table and StudentIndex |
| AWS IAM | Gives API Gateway access only to the complaint table and its StudentIndex |
| AWS CloudFormation | Defines the REST API, methods, stage, IAM role, and website read policy |

**Request flow:** The browser loads static HTML, CSS, and JavaScript from S3. API Gateway uses direct service integrations to call DynamoDB: `PutItem` for a complaint, `Query` on StudentIndex for student tracking, `Scan` for the demo admin list, and `UpdateItem` for status changes. No Lambda function is involved.

The site is hosted at the S3 website endpoint using HTTP. The API endpoint uses HTTPS. API Gateway is throttled to 5 requests per second with a burst of 10; list calls return at most 100 records.

## 3. Application functionality

The frontend uses HTML, CSS, and vanilla JavaScript. It supports complaint submission, student-ID tracking, a complaints dashboard, and status changes. Student-entered content is escaped before rendering. Photos and notification flows are excluded from this demo.

## 4. Cloud computing concepts

- **Managed serverless API:** API Gateway handles HTTP requests without an application server.
- **NoSQL storage:** DynamoDB stores complaint items and provides a secondary index for student lookup.
- **Object storage:** S3 hosts the static frontend.
- **Infrastructure as Code:** CloudFormation defines repeatable API resources and access permissions.
- **Least-privilege service access:** API Gateway assumes one role with only the required DynamoDB actions scoped to this table and index.

## 5. Demonstration and verification

Use fictional information only.

1. Open the hosted Student Portal and confirm the API indicator shows connected.
2. Submit a fictional complaint.
3. Search with the same fictional student ID.
4. Open the Admin Dashboard and change the status.
5. Refresh student tracking and confirm the updated status.

The deployed workflow was verified with a synthetic item (`DEMO-0001`, `demo.student@example.invalid`): submission, tracking, admin listing, CORS preflight, status update, and re-reading the updated status all succeeded.

## 6. Limitations and future work

This is an academic prototype, not a campus service. The API is unauthenticated: anyone with the API or website URLs can list complaint records and change status. Student ID does not prove identity, and the admin page is not protected. Use only dummy information. Before real use, add authentication and authorization and host the website over HTTPS.

Photo uploads and SNS/SQS email or notification processing were removed to reduce setup complexity. Lambda creation was denied by the account's AWS permissions, so the backend was simplified to API Gateway direct integrations instead of retrying or bypassing the restriction. No account controls were bypassed.

## Conclusion

The deployed project demonstrates a complete classroom complaint workflow using S3, API Gateway, and DynamoDB. Its small serverless footprint supports the evaluation demo; the unauthenticated access is a known and significant demo-only limitation.
