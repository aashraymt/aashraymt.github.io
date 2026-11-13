---
title: "SMS Spam Detector"
description: "A Naive Bayes classifier that labels SMS messages as spam or ham, with the text preprocessing and hyperparameter tuning done properly around it."
kind: project
tags: [machine-learning, project]
order: 20
status: published
source: repo
---

A Naive Bayes classifier that labels SMS messages as spam or ham, with the text preprocessing and hyperparameter tuning done properly around it. I built it to get the full scikit-learn pipeline right, not just to fit a model.

## Why

SMS phishing (smishing) slips past static blocklists because the text is generated fresh each time. A probabilistic classifier does not need an exact match, it works on word frequencies, so it is the natural tool. I used it as an excuse to build a complete, reproducible pipeline end to end: clean the text, train, tune, serialize.

The code is on GitHub: [github.com/aashraymt/sms-spam-detector](https://github.com/aashraymt/sms-spam-detector)

## The honest caveat, up front

The UCI SMS Spam Collection is a small (about 5,572 messages), clean, well-studied dataset. Naive Bayes is a strong, fast baseline on it, and good scores here are expected rather than impressive. This is a solid baseline build, not a novel result, and the dataset is from 2011, so it does not reflect how smishing reads today.

## How Naive Bayes works here

The classifier asks: given these words, what is the probability this message is spam? That is Bayes' theorem.

$$P(A|B) = \frac{P(B|A) \cdot P(A)}{P(B)}$$

* $P(\text{Spam}|\text{Words})$ is what we want (the posterior).
* $P(\text{Words}|\text{Spam})$ is how often these words show up in known spam (the likelihood).
* $P(\text{Spam})$ is the base rate of spam (the prior).

It is called "naive" because it assumes every word is independent of the others, so the likelihood of a message is just the product of its word likelihoods:

$$P(\text{Words}|\text{Spam}) = P(\text{word}_1|\text{Spam}) \cdot P(\text{word}_2|\text{Spam}) \cdots P(\text{word}_n|\text{Spam})$$

That assumption is false about language ("free" and "prize" are not independent) but it makes the math fast and it works well for text.

## Preprocessing

The raw messages are noisy, so the text goes through NLTK normalization. One choice worth calling out: standard cleaning strips all punctuation, but I keep `$` and `!` with a regex, because they carry real signal in financial lures.

```python
import re

df["message"] = df["message"].str.lower()
# keep letters, whitespace, $ and !
df["message"] = df["message"].apply(lambda x: re.sub(r"[^a-z\s$!]", "", x))
```

After that: tokenization, stop-word removal (drop "the", "is", "at" so the model focuses on words like "win" or "claim"), and Porter stemming (so "winning", "wins", and "won" all collapse to "win"). The tokens are then rejoined into a string for the vectorizer.

```
==Before==        Free entry in 2 a wkly comp to win FA Cup final...
==After stem==    free entri wkli comp win fa cup final...
```

## Feature extraction and the pipeline

Text becomes numbers with a bag-of-words `CountVectorizer`, using unigrams and bigrams so the model can tell a casual "free" from the pairing "free prize".

The vectorizer and classifier are chained into a single scikit-learn `Pipeline`. That matters: it guarantees text is always vectorized before classification and stops test data from leaking into the vectorizer's vocabulary during cross-validation.

```python
from sklearn.pipeline import Pipeline
from sklearn.feature_extraction.text import CountVectorizer
from sklearn.naive_bayes import MultinomialNB

vectorizer = CountVectorizer(min_df=1, max_df=0.9, ngram_range=(1, 2))
pipeline = Pipeline([
    ("vectorizer", vectorizer),
    ("classifier", MultinomialNB())
])
```

## Tuning

Naive Bayes has one key knob, alpha, which controls Laplace smoothing (how it handles words it has never seen). I used `GridSearchCV` with 5-fold cross-validation to pick it, scoring on F1 rather than accuracy, because in spam filtering you care about catching spam without flagging real messages.

```python
from sklearn.model_selection import GridSearchCV

param_grid = {"classifier__alpha": [0.01, 0.1, 0.15, 0.2, 0.25, 0.5, 0.75, 1.0]}
grid_search = GridSearchCV(pipeline, param_grid, cv=5, scoring="f1")
grid_search.fit(df["message"], y)
best_model = grid_search.best_estimator_
```

## Results and evidence

Against held-out sample messages the model gave calibrated-looking probabilities: around 1.00 on blatant phishing lures, about 0.96 on a subtler account-compromise message, and around 1.00 on ordinary safe texts.

<p><a href="https://github.com/user-attachments/assets/0947560e-e219-4685-8024-893255865689" rel="noreferrer">Model classifying sample messages with probability scores</a></p>

The `predict_proba` output is the useful part for security work: a confidence score, not a yes/no. In a real pipeline you might auto-block the 99% cases and send the 70% cases to a human. The trained pipeline serializes to a `.joblib` file so it can be loaded and used without retraining.

Keep the caveat in mind: these are strong numbers on a small, friendly dataset, which is what a correct baseline should produce.

## What I'd do next

Test it on a modern, messier smishing corpus and watch the scores drop, then see how much the `$`/`!` preservation and the bigrams actually buy once the vocabulary is unfamiliar.
