# Meeting Time Agreement

Today each team's PM proposes a day and time, and teammates check off with their initials. Your sheet also captures *where* and *how* they meet, and a promise about who owns a schedule change. This adds those pieces and turns the checkbox into a real, recorded agreement.

## What gets added

**1. More detail on the meeting proposal**
The PM's proposal grows to include:
- Where they meet (room, building, or link/place description)
- How they meet: In person, Zoom, or VR headset
- Optional first/second/third choice of meeting mode (matches your study question)

**2. A written Agreement page**
A new page every student reads and signs. It states plainly:
- I agree to the weekly meeting day, time, place, and mode listed for my team.
- If *I* need the time changed, it is *my* responsibility to find a new time that works for everyone — not the Project Manager's and not the team's.
- Any new time must be entered in ClientVault, and Professor Hillman must be notified.
- I will attend and participate.

Signing = typing full name + initials and ticking the box. We store the date/time, the exact wording they signed, and the exact meeting details as they stood at that moment.

**3. Everyone must sign — enforced**
- Each team member sees a reminder banner until they have signed.
- The team page shows a live "4 of 5 agreed" list with who's outstanding.
- If the PM changes day, time, place, or mode, every signature clears and everyone must re-agree — that is the change-negotiation rule in action.

**4. What you see as professor**
- Your existing "Meeting time consensus" panel gains place and mode, plus who has not signed.
- When a team changes an agreed meeting time, you get a notification, since re-agreement is required and the change is logged.

## Notes on your spreadsheet

I'll use it as the field reference only (day, time, PM, firm name, place, mode, the change-responsibility clause). Team member lists are skipped as you asked, and I'm not importing the Winter 2021 responses as data.

## Technical outline

- Migration: add `location`, `meeting_mode`, and optional mode preference columns to `team_meeting_proposals`; add `agreement_version`, `full_name`, and `agreement_text` to `team_meeting_agreements`; extend the existing reset-on-change trigger to cover the new fields.
- New route `src/routes/app.agreement.tsx` rendering the agreement text plus signing form.
- Update `src/components/meeting-time-card.tsx` (PM form fields, signature flow linking to the agreement page) and `src/components/consensus-status-card.tsx` (place/mode, outstanding names).
- Notification row for the professor on any agreed-time change, using the existing notifications table.
