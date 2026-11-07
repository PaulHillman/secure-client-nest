# AI grading review — findings and recommendations (no changes made)

## What grades student submissions today

| Task | File | Model | Provider | Reasoning effort |
|---|---|---|---|---|
| Automatic peer-review score (on upload, official 0–10 integer) | `src/lib/peer-review-auto.server.ts` (`MODEL`, line 9; call ~line 60) | `openai/gpt-6-astra` | OpenAI, through the Lovable AI Gateway | medium |
| Instructor detailed re-grade (one-decimal score) | `src/lib/peer-review-regrade.server.ts` (`MODEL`, line 6; call ~line 50) | `openai/gpt-6-astra` | OpenAI, through the Lovable AI Gateway | high |
| Health-check narrative impact analysis (not student grading) | `src/lib/health-review-guide-impact.functions.ts:47` | `openai/gpt-6-astra` | same | medium |
| Proofs feature (not peer grading) | `src/lib/proofs.server.ts:149` | `google/gemini-2.5-flash` | Google, same gateway | n/a |

How it's configured:
- The model name is written directly in each file; there's no setting in the app to change it.
- Each call uses the gateway's Responses endpoint with `LOVABLE_API_KEY`, strict JSON-schema output and streaming, without storing anything.
- Documents: text is pulled from PDF/DOCX/ODT/TXT, up to 40,000 characters. Scanned PDFs and images are sent as attachments for the model to read.
- The rubric comes from the saved criteria, with `#` and `##` comment lines removed. The neutral grading instructions apply.

## Is a stronger reasoning model supported?
Yes. No new connection or key is needed: the same gateway endpoint takes other models. The project's generated model list (`src/generated/ai-gateway/models.d.ts`) shows these for the Responses endpoint:
- `openai/gpt-5.5-pro` and `openai/gpt-5.4-pro` are "pro" models that think longer.
- Higher reasoning effort: auto-grading runs at medium, so moving it to high is the smallest step up.
- Gemini models (`google/gemini-3.1-pro-preview`, `gemini-2.5-pro`) are offered only on the Chat Completions endpoint here. Switching to them means changing how the request is made, not just the model name.

`gpt-6-astra` is already the newest general-purpose OpenAI model in that list. A "pro" model is the main stronger option.

## Options compared (judgement, not measured)

| Option | Following the rubric | Reading documents/scans | Cost and speed |
|---|---|---|---|
| Keep astra, medium effort (now) | Good; holistic scores have drifted (e.g. Avery's scores ranged 6.8 to 8.6) | Good, reads attached PDFs and images | Baseline |
| Astra, **high** effort for auto-grading | Likely more consistent | Same | Somewhat more output tokens and slower |
| `gpt-5.5-pro` | Probably strongest on detailed rubric checks | Supports file input | Much more expensive per call and slower; fine for about 70 students |
| Gemini 3.1 Pro preview | Strong on long documents | Strong on scans | Needs a different request format; "preview" may change |
| Flash or mini models | Weaker on careful rubric judgement | OK | Cheapest; not recommended for official scores |

I didn't measure costs or check your recorded AI requests; the comparison above comes from how the models are positioned, not from your data.

## Recommendations
1. The biggest source of uneven scores is how the grading is set up, not which model runs it. The model gives one overall score, and the two tasks produce different kinds of score: auto-grading gives a whole number, the re-grade gives a decimal. Scoring each rubric item first, then combining those with a fixed formula, would cut drift more than a stronger model would.
2. If you want a stronger model, try `openai/gpt-5.5-pro` for **re-grades only** first, where scores are few and need the most care. Compare it with astra-high on 5–10 papers you've already graded yourself (Avery, Kordell, the 11 recent re-grades), using your own scores as the benchmark.
3. For auto-grading, raising effort from medium to high is a cheap, low-risk step.
4. Make the model choice one shared setting, so both grading paths stay in step and each saved assessment records which model scored it.
5. Keep past scores unchanged; any change applies only to future assessments.

## If you approve, next step (still no grading changes)
Run an unsaved side-by-side trial, astra-high against gpt-5.5-pro, on your already-graded papers. I'll report the scores and AI usage before you decide anything.
