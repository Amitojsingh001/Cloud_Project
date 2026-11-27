# Campus Issue Tracker

UCS531 serverless classroom demonstration for submitting campus complaints, tracking them by student ID, and updating their status in an admin dashboard.

## Live demo

- Student portal: http://campus-issue-tracker-demo-websitebucket-5vjdj4hwitz9.s3-website-ap-southeast-2.amazonaws.com/
- Admin dashboard: http://campus-issue-tracker-demo-websitebucket-5vjdj4hwitz9.s3-website-ap-southeast-2.amazonaws.com/admin.html
- API base URL: https://snobtw6mkg.execute-api.ap-southeast-2.amazonaws.com/dev
- Region: `ap-southeast-2`
- Stack: `campus-issue-tracker-demo`

## Demo limits

- This classroom demo has no authentication. Anyone who knows the URLs can read the complaint list, submit a complaint, or change status. Use fictional information only.
- The S3 website endpoint uses HTTP; browser requests to the API use HTTPS.
- Photo uploads, SNS/email notifications, SQS/DLQ processing, and Lambda functions are not used.
- API throttling is set to 5 requests/second with a burst of 10. Each list endpoint returns at most 100 complaints.

## AWS architecture

- S3 static website for `frontend/`.
- API Gateway REST API with direct DynamoDB service integrations for submission, student-ID tracking, admin listing, and status updates.
- Existing DynamoDB on-demand table and `StudentIndex`, reused without replacement.
- One IAM role trusted by API Gateway, scoped to the table and index operations needed by the API.
- CloudFormation stack defines the API, role, methods, stage, and public read-only website bucket policy. It does not own the retained table or website bucket.

No EC2, NAT Gateway, RDS, Lambda, SQS, SNS, photo bucket, or notification worker is used.

## Local validation

From the project root in PowerShell:

```powershell
sam validate --lint --template-file infra/template.yaml
node --check frontend/app.js
node --check frontend/config.js
```

`infra/template.yaml` is pure CloudFormation and can also be validated with `aws cloudformation validate-template`.

## Demo workflow

1. Open the Student Portal and wait for the API indicator to show connected.
2. Submit a complaint with fictional student details.
3. Search with the same Student ID to track the complaint.
4. Open `admin.html`, find the complaint, and set its status.
5. Refresh student tracking to confirm the updated status.

For safety, do not enter real student details, private information, or photos. The API does not authenticate the student or admin views.

## Deployment notes

The deployed template reuses the existing complaint table and static website bucket by name. Before future stack updates, inspect the CloudFormation change set and preserve those physical resources. `PublicWebsitePolicy` grants only `s3:GetObject` on the website bucket. The website bucket and table were retained when cleaning up the blocked Lambda deployment attempt.
