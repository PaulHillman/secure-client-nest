type CompanyRecord = {
  company_name: string;
  contact_person: string;
  contact_job_title: string;
  industry: string;
  employee_count: string | null;
  hq_address: string | null;
};

/** Preserve written answers; identify any fallback as current team information. */
export function resolveReviewAnswers(answers: Record<string, string>, company: CompanyRecord | null) {
  const resolved = { ...answers };
  const currentRecordFields: string[] = [];
  if (company) {
    const fields: Record<string, string | null> = {
      company_name: company.company_name,
      manager_name: company.contact_person,
      manager_title: company.contact_job_title,
      industry: company.industry,
      company_size: company.employee_count,
      location: company.hq_address,
    };
    for (const [key, raw] of Object.entries(fields)) {
      const value = raw?.trim();
      if (!resolved[key]?.trim() && value && !/example\.invalid|not (supplied|provided|available|known)|^(unknown|n\/?a|tbd|none)$/i.test(value)) {
        resolved[key] = value;
        currentRecordFields.push(key);
      }
    }
  }
  return { answers: resolved, currentRecordFields };
}