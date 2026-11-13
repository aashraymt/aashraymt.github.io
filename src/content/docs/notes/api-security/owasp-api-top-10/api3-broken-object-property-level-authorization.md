---
title: "API3:2023 Broken Object Property Level Authorization"
description: "Broken Object Property Level Authorization (BOPLA) combines two items from the 2019 list: excessive data exposure and mass assignment."
kind: note
category: "API Security"
tags: [api-security, owasp-api, notes]
order: 20
status: published
source: repo
---

Broken Object Property Level Authorization (BOPLA) combines two items from the 2019 list: excessive data exposure and mass assignment. OWASP merged them because both come from the same root cause, missing authorization checks at the level of an object's properties.

An endpoint is vulnerable if it:

* Exposes properties of an object that the user should not be able to read (previously "Excessive Data Exposure").
* Lets a user change, add, or delete the value of a sensitive property they should not be able to touch (previously "Mass Assignment").

## Excessive data exposure

The API responds with more than the request needs. It often happens when the provider expects the consumer to filter the results, so it sends the entire object. Asking for a name and getting back a date of birth, email, phone number, and details about other people is the same problem.

If a consumer requests their own account and the response also includes other users' accounts, the API is exposing excessive data.

This bypasses every control that protects the data, because the API simply hands it over. To detect it, test the endpoints and read what comes back. Fuzzing can help find hidden properties, and side-effect analysis may be needed when a property is not returned in the response.

## Mass assignment

The consumer sends more parameters than the application intended, and the application binds them to internal variables or objects. The consumer may then edit object properties or escalate privileges.

An account update function, for example, should only change a username, password, and address. If the consumer can also send the privilege level or an account balance and the application accepts it without checking against an allowlist, those values can be changed.

Take an account creation request with two parameters:

```json
{
  "User": "hapi_hacker",
  "Password": "GreatPassword123"
}
```

If the API documentation mentions an extra property, `isAdmin`, used to create administrator accounts, an attacker can add it:

```json
{
  "User": "hapi_hacker",
  "Password": "GreatPassword123",
  "isAdmin": true
}
```

If the API does not filter the input, the backend adds `"isAdmin": true` to the user object and the new user is effectively an administrator.

To test for mass assignment, find sensitive parameters in the documentation, add them to a request, and check in later requests whether the object changed.

## Mitigation

* When exposing an object, confirm the user should have access to every property you return.
* Avoid generic serializers like `to_json()` and `to_string()`. Pick the specific properties to return.
* Avoid functions that automatically bind client input to internal variables, objects, or properties.
* Allow changes only to the properties the client is meant to update.
* Validate responses against a schema as an extra layer, and enforce the data each method may return.
* Keep returned data structures to the minimum the endpoint needs.

## References

* [API3:2019 Excessive Data Exposure](https://github.com/OWASP/API-Security/blob/master/2019/en/src/0xa3-excessive-data-exposure.md)
* [API6:2019 Mass Assignment](https://github.com/OWASP/API-Security/blob/master/2019/en/src/0xa6-mass-assignment.md)
* [Mass Assignment Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html)
* [CWE-213: Exposure of Sensitive Information Due to Incompatible Policies](https://cwe.mitre.org/data/definitions/213.html)
* [CWE-915: Improperly Controlled Modification of Dynamically-Determined Object Attributes](https://cwe.mitre.org/data/definitions/915.html)
