import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, Mail, Globe, MapPin, Pencil, Plus } from "lucide-react";

export type CompanyFocus = {
  id?: string;
  team_id: string;
  company_name: string | null;
  contact_person: string | null;
  contact_job_title: string | null;
  website: string | null;
  email: string | null;
  hq_address: string | null;
  industry: string | null;
  employee_count: string | null;
};

export function CompanyFocusCard({
  teamId,
  cf,
  queryKey,
}: {
  teamId: string;
  cf: CompanyFocus | null | undefined;
  queryKey: unknown[];
}) {
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: async (v: Partial<CompanyFocus>) => {
      if (cf?.id) {
        const { error } = await supabase.from("company_focus").update(v as any).eq("id", cf.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("company_focus")
          .insert({ ...v, team_id: teamId } as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Company focus saved");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!cf) {
    return (
      <Card className="mt-6 border-dashed">
        <CardContent className="py-6 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">No company focus set yet.</p>
          <CompanyFocusDialog
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add company focus
              </Button>
            }
            onSubmit={(v) => save.mutate(v)}
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6 border-border/60">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="font-display text-xl flex items-center gap-2">
              <Building2 className="h-5 w-5 text-gold" />
              {cf.company_name}
            </CardTitle>
            {cf.industry && <p className="text-sm text-muted-foreground">{cf.industry}</p>}
          </div>
          <CompanyFocusDialog
            initial={cf}
            trigger={
              <Button size="sm" variant="outline">
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Button>
            }
            onSubmit={(v) => save.mutate(v)}
          />
        </div>
      </CardHeader>
      <CardContent className="text-sm grid sm:grid-cols-2 gap-3">
        {cf.contact_person && (
          <div>
            <div className="text-foreground">{cf.contact_person}</div>
            <div className="text-muted-foreground">{cf.contact_job_title}</div>
          </div>
        )}
        {cf.email && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Mail className="h-4 w-4" />
            <a href={`mailto:${cf.email}`} className="hover:text-foreground">
              {cf.email}
            </a>
          </div>
        )}
        {cf.website && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Globe className="h-4 w-4" />
            <a
              href={cf.website.startsWith("http") ? cf.website : `https://${cf.website}`}
              target="_blank"
              rel="noreferrer"
              className="hover:text-foreground"
            >
              {cf.website}
            </a>
          </div>
        )}
        {cf.hq_address && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="h-4 w-4" /> {cf.hq_address}
          </div>
        )}
        {cf.employee_count && (
          <div className="text-muted-foreground">{cf.employee_count} employees</div>
        )}
      </CardContent>
    </Card>
  );
}

function CompanyFocusDialog({
  initial,
  trigger,
  onSubmit,
}: {
  initial?: Partial<CompanyFocus>;
  trigger: React.ReactNode;
  onSubmit: (v: Partial<CompanyFocus>) => void;
}) {
  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState(initial?.company_name ?? "");
  const [contactPerson, setContactPerson] = useState(initial?.contact_person ?? "");
  const [contactJob, setContactJob] = useState(initial?.contact_job_title ?? "");
  const [industry, setIndustry] = useState(initial?.industry ?? "");
  const [website, setWebsite] = useState(initial?.website ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [hqAddress, setHqAddress] = useState(initial?.hq_address ?? "");
  const [employeeCount, setEmployeeCount] = useState(initial?.employee_count ?? "");

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          setCompanyName(initial?.company_name ?? "");
          setContactPerson(initial?.contact_person ?? "");
          setContactJob(initial?.contact_job_title ?? "");
          setIndustry(initial?.industry ?? "");
          setWebsite(initial?.website ?? "");
          setEmail(initial?.email ?? "");
          setHqAddress(initial?.hq_address ?? "");
          setEmployeeCount(initial?.employee_count ?? "");
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-xl">Edit company focus</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Company name</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} maxLength={200} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Contact person</Label>
              <Input value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} maxLength={200} />
            </div>
            <div>
              <Label>Job title</Label>
              <Input value={contactJob} onChange={(e) => setContactJob(e.target.value)} maxLength={200} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Industry</Label>
              <Input value={industry} onChange={(e) => setIndustry(e.target.value)} maxLength={100} />
            </div>
            <div>
              <Label># of employees</Label>
              <Input value={employeeCount} onChange={(e) => setEmployeeCount(e.target.value)} maxLength={50} />
            </div>
          </div>
          <div>
            <Label>Website</Label>
            <Input value={website} onChange={(e) => setWebsite(e.target.value)} maxLength={500} placeholder="https://" />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} maxLength={255} />
          </div>
          <div>
            <Label>HQ address</Label>
            <Input value={hqAddress} onChange={(e) => setHqAddress(e.target.value)} maxLength={500} />
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!companyName.trim()}
            onClick={() => {
              onSubmit({
                company_name: companyName.trim() || null,
                contact_person: contactPerson.trim() || null,
                contact_job_title: contactJob.trim() || null,
                industry: industry.trim() || null,
                website: website.trim() || null,
                email: email.trim() || null,
                hq_address: hqAddress.trim() || null,
                employee_count: employeeCount.trim() || null,
              });
              setOpen(false);
            }}
          >
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
