import { KeyRound, LogOut, Mail, ShieldCheck, UserRound } from "lucide-react";
import { signOutSessionAction } from "@/app/actions/auth";
import { AdminPageHeader } from "@/components/admin/admin-ui";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { currentStaff } from "@/lib/auth/staff";

function IdentityRow({ label, value, icon: Icon }: { label: string; value: string; icon: typeof UserRound }) {
  return (
    <div className="grid gap-3 px-1 py-4 sm:grid-cols-[2.25rem_minmax(0,.7fr)_minmax(0,1.3fr)] sm:items-center sm:px-3">
      <span className="grid size-9 place-items-center rounded-lg border border-border bg-background text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <span className="text-xs font-semibold uppercase tracking-[.08em] text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export default async function AccountSettingsPage() {
  const { supabase, scope } = await currentStaff();
  const [{ data: authData }, { data: memberRow }] = await Promise.all([
    supabase.auth.getUser(),
    scope.profileId
      ? supabase
          .from("school_members")
          .select("first_name,last_name,staff_number,role,status,qualifier_access")
          .eq("id", scope.profileId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const member = memberRow as {
    first_name: string;
    last_name: string;
    staff_number: string | null;
    role: string;
    status: string;
    qualifier_access: boolean;
  } | null;
  const displayRole = scope.isAdmin ? "Administrator" : "Teacher";
  const fullName = member ? `${member.first_name} ${member.last_name}` : "Staff account";
  const initials = member ? `${member.first_name.charAt(0)}${member.last_name.charAt(0)}`.toUpperCase() : "FS";

  return (
    <div>
      <AdminPageHeader
        eyebrow="Account & access"
        title="Staff identity"
        description={scope.isAdmin
          ? "Review the administrator identity and authenticated account that grants school-wide configuration access."
          : "Review the teacher identity and authenticated account connected to your teaching settings."}
      />

      <section className="flex flex-col gap-5 border-y border-border bg-muted/20 px-1 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-3">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar size="lg" className="size-12">
            <AvatarFallback className="font-display font-extrabold text-foreground">{initials}</AvatarFallback>
            {member?.status === "active" ? <AvatarBadge /> : null}
          </Avatar>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate font-display text-xl font-extrabold tracking-tight text-foreground">{fullName}</h2>
              <Badge variant="outline">{displayRole}</Badge>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{authData.user?.email ?? "Authenticated staff session"}</p>
          </div>
        </div>
        <Badge variant={member?.status === "active" ? "secondary" : "destructive"}>{member?.status === "active" ? "Active account" : "Account needs attention"}</Badge>
      </section>

      <section aria-labelledby="identity-heading" className="mt-7">
        <div className="pb-3">
          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Identity record</p>
          <h2 id="identity-heading" className="mt-1 font-display text-lg font-extrabold text-foreground">School member & authentication</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">These values come from the current `school_members` record and Supabase authenticated user. They are displayed here without creating a second profile settings store.</p>
        </div>
        <div className="divide-y divide-border border-y border-border">
          <IdentityRow label="Staff name" value={fullName} icon={UserRound} />
          <IdentityRow label="School role" value={displayRole} icon={ShieldCheck} />
          <IdentityRow label="Staff number" value={member?.staff_number ?? "Not assigned"} icon={KeyRound} />
          <IdentityRow label="Sign-in email" value={authData.user?.email ?? "Not available"} icon={Mail} />
        </div>
      </section>

      <section className="mt-7">
        {scope.isAdmin ? (
          <Alert>
            <ShieldCheck />
            <AlertTitle>Administrator access</AlertTitle>
            <AlertDescription>This account can manage school-wide academic configuration, staff scope, classes and the administrator-only School Data operations workspace.</AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <ShieldCheck />
            <AlertTitle>Teacher access</AlertTitle>
            <AlertDescription>{scope.qualifierAccess ? "Qualifier examination access is enabled for this teacher account." : "Qualifier examination access is not assigned to this teacher account. An administrator controls that permission."}</AlertDescription>
          </Alert>
        )}
      </section>

      <section aria-labelledby="session-heading" className="mt-7 border-y border-border">
        <div className="grid gap-4 px-1 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:px-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.14em] text-muted-foreground">Session</p>
            <h2 id="session-heading" className="mt-1 text-sm font-semibold text-foreground">End this authenticated session</h2>
            <p className="mt-1 text-sm leading-5 text-muted-foreground">Sign out after using a shared school computer or whenever you need to switch staff accounts.</p>
          </div>
          <form action={signOutSessionAction}>
            <input type="hidden" name="surface" value="staff" />
            <Button type="submit" variant="outline">
              <LogOut data-icon="inline-start" />
              Sign out
            </Button>
          </form>
        </div>
      </section>
    </div>
  );
}
