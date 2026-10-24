ALTER TABLE public.peer_review_criteria DROP CONSTRAINT peer_review_criteria_id_check;
ALTER TABLE public.peer_review_criteria ADD CONSTRAINT peer_review_criteria_id_check CHECK (id IN ('peer-review', 'health-review'));
INSERT INTO public.peer_review_criteria (id, content, reminder_month_day, updated_at)
VALUES ('health-review', $doc$WEEKLY HEALTH CHECK REVIEW — WHAT RUNS EACH WEEK
Instructor reference. Editing this document does not change the automated checks; it records what they do so changes week to week are visible. Update it whenever a rule is added, retired or adjusted, then mark it reviewed for the week.

SCHEDULE
- Run and send on Fridays. Due dates are always Sunday 11:59 p.m. (America/Detroit).
- Report emails go to every team member, copy the Project Manager, and copy HillmanP@gvsu.edu. All sends are logged in the email log.
- The same PDF is placed in each team's File Vault → Team Documents → Health Reports (read-only). Students see a banner for up to 2 logins, gone once clicked.
- C/D/H Consulting (test team) is excluded from every run, queue and count.

CHECKS
1. Dashboard Gaps — missing profile, roster or setup items.
2. Team Readiness — "Ready", "Attention needed" (yellow) or "Action required" (red).
3. Weekly Meetings — red if no meeting logged in 13 days, yellow after 7. Each meeting is checked individually; agenda/minutes must be linked explicitly to the meeting. Missing connections are reminders only, no grading penalty. Minutes are compared with the supplied template (meetings before 9/27/26 exempt).
4. Login / upload activity — relative to teammates; yellow after 7 days without activity.
5. File Vault requirements — semester-aware. Client research: at least 2 files by 10/18; org charts do not count. Misfiled research is flagged to the Tech Admin, never moved automatically.
   Client Communications: three-week grace, then 0 files red, 1 yellow, 2+ green.
6. Health Report follow-up — names students who have not opened the last shared report.

WEEK-TO-WEEK COMPARISON
- Compared against each team's last report actually emailed to students (Save and vault refresh do not move the baseline).
- Compliments only for verified improvements; unverified evidence stays "unverified".
- Escalation per concern and per person: 2nd consecutive week = red warning, 3rd = grade-deduction notice.
- Low Engagement: week 1 note, week 2 yellow, week 3+ red (started 10/17/26; opening a health report alone does not count as engagement).
- Reporting corrections are instructor-only and hidden from students.

PEER REVIEWS
- Individual analysis is emailed separately; summaries appear in the Friday report.
- Original 7–10 passes. Below 7 needs an 8+ revision or a scheduled meeting by Sun 11/1 11:59 p.m.

RETIRED / PAUSED THIS SEMESTER
- Selection-rationale check (restore next semester).
- Interview Plan form — interview question quality is judged in the weekly review instead.

CHANGE LOG (add a line each week)
- Week of 10/19/26: document created.
$doc$, '01-01', now())
ON CONFLICT (id) DO NOTHING;