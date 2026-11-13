---
title: "Multi-cloud log pipeline: CloudTrail to Elastic"
description: "The AWS leg of my Multi-Cloud Detection Lab: CloudTrail to S3 to SQS to Filebeat to Elastic, and why the queue sits in the middle."
kind: writeup
category: "Detection Engineering"
tags: [detection, cloud, writeup]
order: 10
status: published
source: repo
---

<div class="callout info">

TL;DR: In my Multi-Cloud Detection Lab I built the AWS leg of the pipeline: CloudTrail writes to a private S3 bucket, S3 notifies an SQS queue, Filebeat reads the queue and ships the events to Elastic. This page explains why the queue sits in the middle and what I would alert on first. It is a personal lab built during the MCBTA certification, not work for an employer.

</div>

| Category | Difficulty | Platform | Date | Tools | Mapping |
|---|---|---|---|---|---|
| Detection engineering, cloud logging | Easy | Personal lab (built during the MCBTA certification) | Jul to Aug 2025 | AWS CloudTrail, S3, SQS, Filebeat, Elasticsearch, Kibana | T1562.008, T1078.004, T1098.001 |

## Scope and environment

The lab is an Elastic Stack (Elasticsearch, Logstash, Filebeat, Kibana) that ingests logs from AWS, Azure, and GCP, with TheHive for case management. This page covers only the AWS path. Everything ran in my own lab AWS account and on a lab monitoring server.

Repo: https://github.com/aashraymt/SIEM-Log-Analysis-Threat-Detection-Lab

## Recon and approach

I wanted to answer one question from Kibana: who did what in this AWS account, and when? CloudTrail is the source for that. It records API activity across the account. The work is getting those records from AWS into a place where I can search and alert on them.

```text
CloudTrail --> S3 bucket (private) --> S3 event notification --> SQS queue
                                                                    |
                                                    Filebeat (aws module) polls
                                                                    |
                                                    Elasticsearch --> Kibana
```

### Why SQS sits in the middle

CloudTrail does not push events to a SIEM. It drops compressed log files into S3 every few minutes. Something has to notice each new file and fetch it.

Without a queue, the shipper would have to list the bucket over and over and remember which objects it had already read. That gets slow and expensive as the bucket grows.

With a queue, S3 announces each new object by putting a message on SQS. Filebeat reads a message, downloads the object the message points to, ships the events, and then deletes the message. Three things follow from that design:

- The producer and the consumer are decoupled. AWS keeps writing logs whether or not my monitoring server is up.
- It is a buffer. If Filebeat is down for an hour, the messages wait in the queue and get processed when it comes back. Nothing is skipped.
- A message is only deleted after it is handled. If Filebeat crashes mid-file, the message becomes visible again and is retried.

## Build

### 1. CloudTrail and S3

I created a trail and pointed it at a private S3 bucket. CloudTrail asks which event types to record. Management events (create, change, and delete operations on resources) were the ones I cared about for detection. Data events, such as individual S3 object reads, are much higher volume, so I left them for cases where I need them.

Before going further, I checked the bucket to confirm log files were arriving under the expected `AWSLogs/<account-id>/CloudTrail/` prefix. There is no point wiring up the rest if the first hop is not working.

### 2. The queue and its access policy

I created a standard SQS queue with default settings. By default, S3 is not allowed to send to it, so the queue needs an access policy that permits the send action, limited to my account and my bucket.

One thing worth knowing: the policy editor rejects JSON that contains comments. If you paste an annotated example, strip the comments first.

### 3. Connecting S3 to SQS

On the bucket, under event notifications, I added a notification for object creation events and set the destination to the queue. From that point on, every new CloudTrail log file produces one message.

### 4. Filebeat

On the monitoring server, I enabled Filebeat's AWS module and turned on its CloudTrail input with the queue URL and credentials for a dedicated IAM user.

```yaml title="/etc/filebeat/modules.d/aws.yml"
- module: aws
  cloudtrail:
    enabled: true
    var.queue_url: <sqs-queue-url>
    var.access_key_id: <redacted>
    var.secret_access_key: <redacted>
```

After restarting Filebeat, I opened Discover in Kibana, selected the Filebeat index, and confirmed that CloudTrail events were arriving and parsed into fields.

### What I would do differently

In the lab, the IAM user that Filebeat used had broad managed policies for S3 and SQS. That was fine for getting it working and wrong for anything real. The shipper only needs to receive and delete messages on one queue and read objects from one bucket. I would also move from long-lived access keys to a role.

### What I would alert on first

With CloudTrail flowing, these are the first rules I would write, in this order:

1. Changes to logging itself. A trail being stopped, deleted, or modified. If the logs go away, every other rule is blind, so this comes first (T1562.008).
2. Root account use, and console sign-ins without MFA (T1078.004).
3. New credentials and new privileges. An access key created for a user, or an administrative policy attached to a user or role (T1098.001).
4. A burst of access-denied errors from one identity. That pattern is what enumeration with a stolen key looks like.

## Attacker's perspective and evasion

If I had access to this account and wanted to stay quiet, the pipeline itself is the target.

- Turn off the source. Stop or alter the trail so events are no longer recorded. That is why the first alert is on the trail.
- Break a hop. Remove the bucket notification, change the queue policy, or purge the queue. CloudTrail keeps writing, but nothing reaches Elastic. From the SIEM, this looks like silence, not like an attack.
- Work outside the trail's scope. If the trail records only management events, reads of data inside a bucket are not logged. If it covers one region, activity in another region is missed.
- Use the delay. CloudTrail delivers in batches, so there is a gap of minutes between an action and its event becoming searchable.

What that means for detection:

- Alert on the absence of data. If no CloudTrail events arrive for longer than the normal delivery interval, that is a finding. A pipeline needs a heartbeat check as much as it needs rules.
- Alert on changes to the pipeline's own resources: the trail, the bucket policy and notifications, the queue.
- Use a multi-region trail, and decide on purpose which data events are worth their volume.
- Keep the shipper's credentials minimal, so a compromise of the monitoring server does not hand over the account.

## Key takeaways

- CloudTrail delivers files to S3. Getting them into a SIEM needs something to announce each new file, and that is the queue's job.
- A queue between producer and consumer gives buffering and retries, so a shipper outage delays data without losing it.
- Verify each hop before building the next: files in the bucket, messages in the queue, events in Kibana.
- The first detection on any log source should protect the log source.
- Lab shortcuts like broad IAM policies should be named as shortcuts.

## References

- AWS CloudTrail documentation: https://docs.aws.amazon.com/awscloudtrail/latest/userguide/
- Filebeat AWS module: https://www.elastic.co/guide/en/beats/filebeat/current/filebeat-module-aws.html
- MITRE ATT&CK, T1562.008 Impair Defenses: Disable or Modify Cloud Logs: https://attack.mitre.org/techniques/T1562/008/
- Lab repository: https://github.com/aashraymt/SIEM-Log-Analysis-Threat-Detection-Lab
