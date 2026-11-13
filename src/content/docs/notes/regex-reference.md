---
title: "Regex Reference"
description: "Practice notes from a freeCodeCamp regex course, written in Python. Every example below runs through one of three small helper functions."
kind: note
tags: [regex, notes]
order: 60
status: published
source: repo
---

## Helper 1: findall

```python
import re

def matchregex(pattern, text):
    match = re.findall(pattern, text)
    if match:
        print("Found:", ''.join(match))
    else:
        print("No match found")
```

The function takes a pattern and a text and prints every match joined together. If nothing matches it prints `No match found`. One detail to keep in mind: when a pattern contains a capturing group, `re.findall` returns the group contents instead of the whole match. Several outputs below depend on that.

## Quantifiers (repetition)

### Asterisk `*`

`*` applies to the single character or group right before it (a group is something in brackets, like `(abc)`) and matches it as many times as possible, including zero times.

```python
matchregex(r'ab*c', 'abbbc')
# Found: abbbc
```

```python
matchregex(r'ab*c', 'aaabbbc')
# Found: abbbc
```

```python
matchregex(r'(ab)*c', 'ababc')
# Found: ab
```

**Q.** Why didn't the first `a` print in the `aaabbbc` case?

The pattern is looking for `a`, then any number of `b`, then `c`. The first two `a` characters are not followed by `b` or `c`, so the match can only start at the third `a`.

In the `(ab)*c` case the whole string `ababc` matches, but the output is only `ab`. That is the `findall` behavior from above: the pattern has a capturing group, so the group's content is returned instead of the full match.

```python
matchregex(r'abc*d', 'abbbcd')
# No match found
```

**Q.** Why no match?

Only `c` is repeatable in `abc*d`. The string has several `b` characters, and the pattern allows exactly one.

### Plus `+`

`+` matches the character or group before it as many times as possible, but at least once.

```python
matchregex(r'abc+', 'ab')
# No match found
```

There is no `c`, so there is no match. The difference between `*` and `+`:

```python
matchregex(r'abc*', 'ab')
# Found: ab
```

```python
matchregex(r'abc+', 'ab')
# No match found
```

### Question mark `?`

`?` matches the character or group before it zero times or one time.

```python
matchregex(r'https?://', 'https://')
# Found: https://
```

```python
matchregex(r'https?://', 'http://')
# Found: http://
```

```python
matchregex(r'https?://', 'httpss://')
# No match found
```

### Exact count `{n}`

The preceding character or group must appear exactly n times.

```python
matchregex(r'c{5}', 'ccccc')
# Found: ccccc
```

```python
matchregex(r'abc{5}', 'abbccccc')
# No match found
```

```python
matchregex(r'abc{5}', 'abccccc')
# Found: abccccc
```

The second case fails because the pattern wants `a`, one `b`, then five `c`. The string has two `b` characters.

### Minimum count `{n,}`

The preceding character or group must appear at least n times, with no upper limit.

```python
matchregex(r'abc{5,}', 'abcc')
# No match found
```

```python
matchregex(r'abc{5,}', 'abccccc')
# Found: abccccc
```

```python
matchregex(r'abc{5,}', 'abcccccccc')
# Found: abcccccccc
```

### Range count `{n,m}`

The preceding character or group must appear at least n times and at most m times.

```python
matchregex(r'c{5,6}', 'cccccc')   # 6 c characters
# Found: cccccc
```

```python
matchregex(r'c{5,6}', 'ccccc')    # 5 c characters
# Found: ccccc
```

```python
matchregex(r'c{5,6}', 'cccc')
# No match found
```

## Anchors (position)

### Start of line `^`

The pattern must appear at the start of the string. If it only appears later, the match fails.

```python
matchregex(r'^c', 'chatbot')
# Found: c
```

### End of line `$`

The pattern must appear at the end of the string.

```python
matchregex(r't$', 'chatbot')
# Found: t
```

## Character classes

### Dot `.`

A wildcard that matches any single character except a newline (`\n`).

```python
matchregex(r'c.t', 'cat')
# Found: cat
```

```python
matchregex(r'c.t', 'c-t')
# Found: c-t
```

```python
matchregex(r'c.t', 'caat')
# No match found
```

### Character class `[...]`

Matches exactly one character from the set, one position at a time.

```python
matchregex(r'[aeiou]', 'heello')
# Found: eeo
```

```python
matchregex(r'[aeiou]', 'hello')
# Found: eo
```

```python
matchregex(r'[a-z]', 'hello')
# Found: hello
```

```python
matchregex(r'[a-z]', 'Hello')
# Found: ello
```

```python
matchregex(r'[a-zA-Z0-9]', 'Hello123')
# Found: Hello123
```

### Negated character class `[^...]`

Matches any single character that is not in the set.

```python
matchregex(r'[^a]', 'ameow')
# Found: meow
```

```python
matchregex(r'[^a]', 'maeow')
# Found: meow
```

## Predefined character classes

### Digit `\d`

Any single digit from 0 to 9. Spaces are skipped.

```python
matchregex(r'\d', '126748 99')
# Found: 12674899
```

### Non-digit `\D`

Any character that is not a digit, spaces included.

```python
matchregex(r'\D', '126748hello hi')
# Found: hello hi
```

### Word character `\w`

Letters, digits, and the underscore. Spaces are skipped.

```python
matchregex(r'\w', '126748hello hi')
# Found: 126748hellohi
```

### Non-word character `\W`

Any character that is not a word character, spaces included.

```python
matchregex(r'\W', '12 !@#$ $%^&')
# Found:  !@#$ $%^&
```

### Whitespace `\s`

Spaces, tabs, newlines, and other whitespace.

```python
matchregex(r'\s', '126748\t99')
# Found: (a tab, which cannot be seen)
```

### Non-whitespace `\S`

Any character that is not whitespace.

```python
matchregex(r'\S', '126748\t99')
# Found: 12674899
```

## Grouping and alternation

### Capturing group `(...)`

Groups several elements together and remembers what they matched.

```python
matchregex(r'(abc)', 'abc abc abc bc')
# Found: abcabcabc
```

### Alternation `|`

Acts like OR. Matches the pattern before or after the `|`.

```python
matchregex(r'cat|bat|nat', 'cat rhymes with bat, right?')
# Found: catbat
```

## Escape sequences

### Backslash `\`

Escapes special characters such as `*`, `+`, and `.` so they match literally.

## Boundary matchers

### Word boundary `\b`

Matches the position between a word character and a non-word character (or the start or end of the string). It has no width, so it does not consume a character.

```python
matchregex(r'\bbat\b', 'batact')
# No match found
```

```python
matchregex(r'\bbat', 'catbatact')
# No match found
```

```python
matchregex(r'\bbat', 'cat bat act')
# Found: bat
```

```python
matchregex(r'\bbat', 'batact')
# Found: bat
```

Difference between `^...$` and `\b`:

```python
matchregex(r'^bat$', 'cat bat act')
# No match found
```

```python
matchregex(r'\bbat\b', 'cat bat act')
# Found: bat
```

### Non-word boundary `\B`

Matches any position that is not a word boundary, meaning both neighbors are word characters or both are non-word characters.

```python
matchregex(r'\Bbat\B', 'catbatact')
# Found: bat
```

## Special constructs

### Atomic group `(?>...)`

Once an atomic group has matched, the engine will not backtrack into it to try a different way of matching. Python supports this syntax from version 3.11.

```python
matchregex(r"(?>a|ab)c", "abc")
# No match found
```

The engine matches `a` inside the group, then needs `c` but sees `b`. Because the group is atomic, it does not go back and try `ab` instead, so the match fails.

### Positive lookahead `(?=...)`

Checks that a pattern follows the current position without including it in the match.

```python
matchregex(r"\d+(?=\D)", "123abc")
# Found: 123
```

The digits match only if a non-digit follows them, and only the digits are returned.

### Negative lookahead `(?!...)`

Checks that a pattern does not follow the current position.

```python
matchregex(r"\d+(?!\D)", "3abc")
# No match found
```

```python
matchregex(r"\d+(?!\D)", "3")
# Found: 3
```

The digits match only when no non-digit follows them. In `3abc` the `3` is followed by `a`, so it fails.

### Positive lookbehind `(?<=...)`

Checks that a pattern comes right before the current position.

```python
matchregex(r"(?<=\$)\d+", "$300, 400, $500")
# Found: 300500
```

Only digits that have a `$` directly before them match, so `300` and `500` are returned and `400` is not.

### Negative lookbehind `(?<!...)`

Checks that a pattern does not come right before the current position.

```python
matchregex(r"(?<!\$)\d*", "$3, 4, $5")
# Found: 4
```

Only `4` is returned because the other numbers have a `$` in front. Because `\d*` can match zero digits, `findall` also returns several empty matches. They add nothing when joined, which is why the output looks clean.

### Named capture group `(?P<name>...)`

Gives a capturing group a name so it can be referred to later, for example through `match.group('year')`.

## Helper 2: named groups

```python
import re

def matchregex1(pattern, text):
    match = re.search(pattern, text)
    if match:
        print("Found:", match.group('year'))
    else:
        print("No match found")
```

```python
matchregex1(r"(?P<year>\d{4})-(?P<month>\d{2})-(?P<day>\d{2})", "Today's date is 2024-09-19")
# Found: 2024
```

* `(?P<year>\d{4})` captures the year as a group named `year`.
* `(?P<month>\d{2})` captures the month as a group named `month`.
* `(?P<day>\d{2})` captures the day as a group named `day`.

### Non-capturing group `(?:...)`

Groups part of a pattern without saving it as a separate capture. It still takes part in the match.

```python
matchregex(r"(?:http|https)://\w+\.\w+", "Visit our site at https://example.com and http://mysite.com")
# Found: https://example.comhttp://mysite.com
```

```python
matchregex(r"(http|https)://\w+\.\w+", "Visit our site at https://example.com and http://mysite.com")
# Found: httpshttp
```

In the first example `http` or `https` is part of the match but is not saved, so `findall` returns the whole URL. In the second, the group is capturing, so `findall` returns only what the group matched: `https` and `http`.

## Helper 3: search

```python
def matchregex2(pattern, text):
    match = re.search(pattern, text)
    if match:
        print("Found:", match.group())
    else:
        print("No match found")
```

### Conditional group `(?(condition)yes-pattern|no-pattern)`

* `condition`: the number of a group. The condition is true if that group took part in the match.
* `yes-pattern`: what to match if the group matched.
* `no-pattern`: what to match otherwise (optional).

```python
matchregex2(r"(\d{4}-)?(?(1)\d{2}-\d{2}|\d{2}-\d{2})", "2024-09-19")
# Found: 2024-09-19
```

```python
matchregex2(r"(\d{4}-)?(?(1)\d{2}-\d{2}|\d{2}-\d{2})", "09-19")
# Found: 09-19
```

* `(\d{4}-)?` optionally matches a year followed by a hyphen.
* `(?(1)` asks whether that group matched.
* `\d{2}-\d{2}` is the pattern used if the year was present.
* `\d{2}-\d{2}` after the `|` is the pattern used if it was not.

## Mitigation

Regex can also be an attack surface. Patterns with nested quantifiers such as `(a+)+` can backtrack exponentially on crafted input (ReDoS).

* Avoid nested or overlapping quantifiers on input you do not control.
* Use atomic groups (or possessive quantifiers where the engine supports them) to stop backtracking.
* Cap the length of the input before matching.
* Use an engine with linear-time matching, or a match timeout, for untrusted input.
