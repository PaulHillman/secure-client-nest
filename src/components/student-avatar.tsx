import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initialsOf(name?: string | null, email?: string | null) {
  const source = (name ?? "").trim() || (email ?? "").trim();
  if (!source) return "?";
  const parts = source.split(/[\s._@-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1]?.[0] ?? "" : "");
  return letters.toUpperCase() || "?";
}

export function StudentAvatar({
  name,
  email,
  avatarUrl,
  size = 28,
  className,
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
}) {
  return (
    <Avatar
      className={cn("shrink-0 border border-border", className)}
      style={{ width: size, height: size }}
    >
      {avatarUrl ? <AvatarImage src={avatarUrl} alt={name ?? "Student photo"} /> : null}
      <AvatarFallback className="text-[10px] font-semibold">
        {initialsOf(name, email)}
      </AvatarFallback>
    </Avatar>
  );
}

export function StudentName({
  name,
  email,
  avatarUrl,
  size = 28,
  className,
  children,
}: {
  name?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
  size?: number;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2 min-w-0", className)}>
      <StudentAvatar name={name} email={email} avatarUrl={avatarUrl} size={size} />
      <span className="truncate">{children ?? name ?? email ?? "—"}</span>
    </span>
  );
}
