---
title: "Azure Sentinel Honeypot Lab"
description: "A deliberately exposed Windows VM on Azure, with its failed-logon events flowing into Microsoft Sentinel, enriched with geolocation and plotted on a live attack map."
kind: project
tags: [cloud, detection, azure, project]
order: 60
status: published
source: repo
---

A deliberately exposed Windows VM on Azure, with its failed-logon events flowing into Microsoft Sentinel, enriched with geolocation and plotted on a live attack map. Built Sep 2025.

## Why I built it

I wanted to see real attack traffic, not simulated traffic, and build the detection side end to end in a cloud SIEM. An RDP port open to the internet gets found by automated scanners within minutes, which makes it a cheap way to generate a genuine stream of malicious logons to practice on.

## What I built

A honeypot VM wired into Sentinel through a Log Analytics workspace.

```
  exposed Windows VM (RDP open, firewall off)
        |  Azure Monitor Agent forwards Security events
        v
  Log Analytics Workspace  (SecurityEvent table)
        |
        v
  Microsoft Sentinel  --- KQL on Event ID 4625 ---+
        |                                         |
        |   join to geoip watchlist               |
        v                                         v
  attack map workbook  <---------------- latitude / longitude
```

The pieces:

1. **The honeypot.** A Windows 10 VM in its own resource group and virtual network, with inbound RDP (port 3389) allowed from anywhere and the Windows firewall turned off. Within a few minutes the Security event log filled with Audit Failure events, Event ID 4625, which is a failed logon.
2. **Log forwarding.** A Log Analytics workspace, with the Azure Monitor Agent on the VM set to collect Windows security events into the `SecurityEvent` table.
3. **Microsoft Sentinel** on top of that workspace as the SIEM.
4. **Enrichment.** A Sentinel watchlist built from a GeoIP CSV (network range to latitude, longitude, city, country), joined to the failed-logon events by IP.
5. **Visualization.** A Sentinel workbook that runs the join and plots the failed-logon counts by location on a map.

```kusto title="failed logons by location (KQL)"
SecurityEvent
| where EventID == 4625
| extend IpAddress = tostring(SourceIP)
| join kind=leftouter (geoip) on $left.IpAddress == $right.network
| summarize FailureCount = count() by cityname, countryname, latitude, longitude
```

## Technical highlights

**Event ID 4625 as the signal.** Filtering the whole security stream down to one event ID is what turns noise into a clean feed of brute-force attempts. Adding `| distinct Account` shows the usernames attackers try first (administrator, admin, and so on), which is its own small lesson in what defaults to never leave enabled.

**Geo-enrichment with a watchlist.** The raw logs have an IP and nothing else human-readable. The watchlist join is the step that turns an address into a place, which is what makes the map possible. The GeoIP data is approximate, which is fine for a map and would not be fine for a blocking decision.

## Results and evidence

The workbook produced a live map of where the failed RDP logons were coming from, built from real internet scanning against the exposed VM. I am deliberately not putting an attack-count number on this: the volume depends entirely on how long the VM was left exposed, and it is not a meaningful metric.

What this proves: I can build a cloud SIEM pipeline from an endpoint to a visualized detection, and write the KQL and enrichment behind it. What it does not: it detects one narrow thing (failed RDP logons) and does not act on them.

The VM in this lab is intentionally insecure and is meant to be deleted when the lab is done. It is not something to leave running.

Repo: [github.com/aashraymt/Azure-Sentinel-SIEM-Home-Lab](https://github.com/aashraymt/Azure-Sentinel-SIEM-Home-Lab)

## What I'd do next

Turn the query into a scheduled Sentinel analytics rule that raises an incident on a spray from a single source, and add a second detection (a successful logon from a country that only ever appears in the failed-logon data) so the lab covers more than one event type.
