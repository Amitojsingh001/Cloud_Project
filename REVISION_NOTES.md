# Campus Issue Tracker deployment update

## Implemented

- Deployed the student complaint, tracking, admin listing, and status update workflow in `ap-southeast-2`.
- Reused the retained on-demand DynamoDB complaint table and existing S3 website bucket.
- Replaced Lambda handlers with API Gateway direct DynamoDB integrations after the account denied Lambda creation. No permission restriction was bypassed.
- Removed photo uploads, SNS/SQS notifications, and Lambda dependencies to keep the demo simpler.
- Escaped user-controlled text in frontend HTML rendering and removed inline event handlers.
- Added API throttling, scoped DynamoDB IAM actions, public read-only S3 website access, and fictional test data.

## Known demo limitations

- The API and admin operations are public and unauthenticated. Only fictional records may be used.
- The public S3 website endpoint uses HTTP; API traffic uses HTTPS.
- Student and admin list endpoints return up to 100 complaints.

## Validation and deployment

- `sam validate --lint --template-file infra/template.yaml`: passed.
- `node --check frontend/app.js` and `node --check frontend/config.js`: passed.
- CloudFormation service template validation and change-set validation: passed.
- Stack `campus-issue-tracker-demo`: `CREATE_COMPLETE`.
- Synthetic end-to-end API checks: create, track, admin list, CORS, status update, persistence reread passed.
- Public website, admin page, and API configuration fetch: passed.
