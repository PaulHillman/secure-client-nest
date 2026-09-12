export const DEFAULT_PM_DUTIES: { title: string; details: string }[] = [
  {
    title: "Team name, PM and meeting time submitted",
    details:
      "Set the management firm (team) name, confirm the Project Manager, and enter the agreed meeting day, time and place in ClientVault.",
  },
  {
    title: "All four team roles assigned",
    details:
      "Communication Specialist, Video Specialist, Company Liaison and Client Vault & Tech Administrator are assigned and understood.",
  },
  {
    title: "Client company and manager entered",
    details:
      "Company name, industry, employee count, address and website, plus the manager's name, title and email.",
  },
  {
    title: "Manager's basic job responsibilities recorded",
    details:
      "A short description of what the client manager actually does day to day, entered on the company card.",
  },
  {
    title: "Project information sheet complete",
    details: "All fields on the project information sheet filled in and submitted for review.",
  },
  {
    title: "Agenda and meeting minutes uploaded",
    details: "Every team meeting has an agenda and minutes filed in the vault in the right section.",
  },
  {
    title: "Interview scheduled and confirmed",
    details: "Interview date confirmed with the manager and recorded in the vault.",
  },
];

export function dutyState(dueAt: string | null, completedAt: string | null | undefined) {
  if (completedAt) {
    const late = dueAt ? new Date(completedAt) > new Date(dueAt) : false;
    return late ? ("late" as const) : ("done" as const);
  }
  if (!dueAt) return "open" as const;
  return new Date(dueAt) < new Date() ? ("overdue" as const) : ("open" as const);
}

export function fmtDue(dueAt: string | null | undefined) {
  if (!dueAt) return "No date set";
  return new Date(dueAt).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
